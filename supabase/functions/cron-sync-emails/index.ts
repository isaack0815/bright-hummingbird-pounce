import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow@1.0.155';
import { simpleParser } from 'npm:mailparser';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// --- Helper Functions ---
const b64_to_ab = (b64: string) => { const byteString = Buffer.from(b64, "base64").toString("binary"); const len = byteString.length; const bytes = new Uint8Array(len); for (let i = 0; i < len; i++) { bytes[i] = byteString.charCodeAt(i); } return bytes.buffer; };
const hex_to_ab = (hex: string) => { const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16))); return typedArray.buffer; };
async function decrypt(encryptedData: string, iv_b64: string, key_hex: string): Promise<string> { const keyBuffer = hex_to_ab(key_hex); const key = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]); const iv = new Uint8Array(b64_to_ab(iv_b64)); const data = new Uint8Array(b64_to_ab(encryptedData)); const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data); return new TextDecoder().decode(decrypted); }
const formatAddress = (addr: any): string | null => { if (!addr || !addr.value || addr.value.length === 0) return null; const { name, address } = addr.value[0]; if (!address) return null; return name ? `"${name}" <${address}>` : `<${address}>`; }
async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
// --- End Helper Functions ---

serve(async (req) => {
  console.log("[CRON-SYNC] Function invoked.");
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const receivedSecret = req.headers.get('X-Cron-Secret');
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || receivedSecret !== cronSecret) {
    console.warn("[CRON-SYNC] Unauthorized access attempt.");
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }
  console.log("[CRON-SYNC] Authorization successful.");

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const encryptionKey = Deno.env.get('APP_ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error("APP_ENCRYPTION_KEY secret is not set.");

    const { data: accounts, error: accountsError } = await supabaseAdmin.from('email_accounts').select('user_id, imap_username, encrypted_imap_password, iv');
    if (accountsError) throw accountsError;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No accounts to sync." }), { headers: corsHeaders });
    }
    console.log(`[CRON-SYNC] Found ${accounts.length} accounts to sync.`);

    let totalNewEmailsProcessed = 0;

    for (const account of accounts) {
      const user_id = account.user_id;
      console.log(`[CRON-SYNC] Starting sync for user: ${user_id}`);
      try {
        const decryptedPassword = await decrypt(account.encrypted_imap_password, account.iv, encryptionKey);
        
        const { data: existingEmails } = await supabaseAdmin.from('emails').select('uid, mailbox').eq('user_id', user_id);
        const existingUidsByMailbox = (existingEmails || []).reduce((acc, email) => {
          if (!acc[email.mailbox]) acc[email.mailbox] = new Set();
          acc[email.mailbox].add(email.uid);
          return acc;
        }, {} as Record<string, Set<number>>);

        const client = new ImapFlow({
            host: Deno.env.get('IMAP_HOST')!, port: 993, secure: true,
            auth: { user: account.imap_username, pass: decryptedPassword },
            tls: { rejectUnauthorized: false }, logger: false
        });

        await client.connect();
        try {
          const mailboxes = await client.list();
          for (const mailbox of mailboxes) {
            if (mailbox.flags.has('\\Noselect')) continue;
            await client.mailboxOpen(mailbox.path);
            const serverUids = await client.search({ all: true });
            const newUids = serverUids.filter(uid => !(existingUidsByMailbox[mailbox.path]?.has(uid)));

            if (newUids.length > 0) {
              console.log(`[CRON-SYNC] Found ${newUids.length} new emails in "${mailbox.path}" for user ${user_id}.`);
              totalNewEmailsProcessed += newUids.length;
              const messages = client.fetch(newUids, { source: true, uid: true });
              for await (const msg of messages) {
                if (!msg.source) continue;
                const source = await streamToBuffer(msg.source);
                const parsed = await simpleParser(source);

                const emailData = { user_id, uid: msg.uid, mailbox: mailbox.path, from_address: formatAddress(parsed.from), to_address: formatAddress(parsed.to), subject: parsed.subject, sent_at: parsed.date, body_text: parsed.text, body_html: parsed.html };
                const { data: insertedEmail, error: insertEmailError } = await supabaseAdmin.from('emails').insert(emailData).select('id').single();
                if (insertEmailError) { console.error(`[CRON-SYNC] Failed to insert email UID ${msg.uid}:`, insertEmailError); continue; }

                if (parsed.attachments && parsed.attachments.length > 0) {
                  for (const attachment of parsed.attachments) {
                    if (typeof attachment.content === 'string' || !attachment.filename) continue;
                    const filePath = `${user_id}/${msg.uid}/${attachment.filename}`;
                    await supabaseAdmin.storage.from('email-attachments').upload(filePath, attachment.content, { contentType: attachment.contentType, upsert: true });
                    await supabaseAdmin.from('email_attachments').insert({ email_id: insertedEmail.id, file_name: attachment.filename, file_path: filePath, file_type: attachment.contentType });
                  }
                }
              }
            }
          }
        } finally {
          await client.logout();
        }
      } catch (e) {
        console.error(`[CRON-SYNC] Failed to sync emails for user ${user_id}:`, e.message);
      }
    }

    console.log(`[CRON-SYNC] Sync finished. Processed a total of ${totalNewEmailsProcessed} new emails.`);
    return new Response(JSON.stringify({ message: `Sync complete. Processed ${totalNewEmailsProcessed} new emails.` }), { headers: corsHeaders });

  } catch (e) {
    console.error("[CRON-SYNC] CATASTROPHIC ERROR:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
})