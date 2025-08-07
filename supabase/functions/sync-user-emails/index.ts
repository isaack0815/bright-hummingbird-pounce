import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow@1.0.155'; // Pinning version for stability
import { simpleParser } from 'npm:mailparser';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";

// Decryption logic
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

serve(async (req) => {
  const { user_id } = await req.json();
  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400 });
  }
  console.log(`[SYNC-USER] Starting sync for user: ${user_id}`);

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    // 1. Fetch credentials
    console.log(`[SYNC-USER] [${user_id}] Step 1: Fetching credentials...`);
    const { data: creds, error: credsError } = await supabaseAdmin.from('email_accounts').select('imap_username, encrypted_imap_password, iv').eq('user_id', user_id).single();
    if (credsError) throw new Error(`Failed to fetch credentials: ${credsError.message}`);
    if (!creds) throw new Error("Email account not configured.");
    console.log(`[SYNC-USER] [${user_id}] Step 1.1: Credentials found for ${creds.imap_username}.`);
    const decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, Deno.env.get('APP_ENCRYPTION_KEY')!);
    console.log(`[SYNC-USER] [${user_id}] Step 1.2: Password decrypted.`);

    // 2. Fetch existing UIDs from DB for this user
    console.log(`[SYNC-USER] [${user_id}] Step 2: Fetching existing email UIDs from DB...`);
    const { data: existingEmails } = await supabaseAdmin.from('emails').select('uid, mailbox').eq('user_id', user_id);
    const existingUidsByMailbox = (existingEmails || []).reduce((acc, email) => {
      if (!acc[email.mailbox]) acc[email.mailbox] = new Set();
      acc[email.mailbox].add(email.uid);
      return acc;
    }, {} as Record<string, Set<number>>);
    console.log(`[SYNC-USER] [${user_id}] Step 2.1: Found existing UIDs for ${Object.keys(existingUidsByMailbox).length} mailboxes.`);

    // 3. Connect to IMAP and find new emails
    console.log(`[SYNC-USER] [${user_id}] Step 3: Connecting to IMAP server...`);
    const client = new ImapFlow({
        host: Deno.env.get('IMAP_HOST')!,
        port: 993,
        secure: true,
        auth: { user: creds.imap_username, pass: decryptedPassword },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    await client.connect();
    console.log(`[SYNC-USER] [${user_id}] Step 3.1: IMAP connection successful.`);
    let totalNewEmails = 0;

    try {
      const mailboxes = await client.list();
      console.log(`[SYNC-USER] [${user_id}] Step 3.2: Found ${mailboxes.length} mailboxes.`);
      for (const mailbox of mailboxes) {
        if (mailbox.flags.has('\\Noselect')) continue;
        
        await client.mailboxOpen(mailbox.path);
        const serverUids = await client.search({ all: true });
        const existingUids = existingUidsByMailbox[mailbox.path] || new Set();
        const newUids = serverUids.filter(uid => !existingUids.has(uid));

        if (newUids.length === 0) {
          console.log(`[SYNC-USER] [${user_id}] No new emails in mailbox "${mailbox.path}".`);
          continue;
        }
        console.log(`[SYNC-USER] [${user_id}] Found ${newUids.length} new emails in "${mailbox.path}".`);
        totalNewEmails += newUids.length;

        // 4. Fetch and save new emails
        console.log(`[SYNC-USER] [${user_id}] Step 4: Fetching new email content...`);
        const messages = client.fetch(newUids, { source: true, uid: true });
        for await (const msg of messages) {
          if (!msg.source) continue;
          const source = await streamToBuffer(msg.source);
          const parsed = await simpleParser(source);

          const emailData = { user_id, uid: msg.uid, mailbox: mailbox.path, from_address: formatAddress(parsed.from), to_address: formatAddress(parsed.to), subject: parsed.subject, sent_at: parsed.date, body_text: parsed.text, body_html: parsed.html };
          const { data: insertedEmail, error: insertEmailError } = await supabaseAdmin.from('emails').insert(emailData).select('id').single();
          
          if (insertEmailError) {
            console.error(`[SYNC-USER] [${user_id}] Failed to insert email UID ${msg.uid}:`, insertEmailError);
            continue;
          }
          console.log(`[SYNC-USER] [${user_id}] Successfully inserted email UID ${msg.uid} with DB ID ${insertedEmail.id}.`);

          if (parsed.attachments && parsed.attachments.length > 0) {
            console.log(`[SYNC-USER] [${user_id}] Found ${parsed.attachments.length} attachments for email UID ${msg.uid}.`);
            for (const attachment of parsed.attachments) {
              if (typeof attachment.content === 'string' || !attachment.filename) continue;
              const filePath = `${user_id}/${msg.uid}/${attachment.filename}`;
              await supabaseAdmin.storage.from('email-attachments').upload(filePath, attachment.content, { contentType: attachment.contentType, upsert: true });
              await supabaseAdmin.from('email_attachments').insert({ email_id: insertedEmail.id, file_name: attachment.filename, file_path: filePath, file_type: attachment.contentType });
              console.log(`[SYNC-USER] [${user_id}] Uploaded attachment: ${attachment.filename}`);
            }
          }
        }
      }
    } finally {
      await client.logout();
      console.log(`[SYNC-USER] [${user_id}] Step 5: IMAP client logged out.`);
    }

    console.log(`[SYNC-USER] Sync completed for user ${user_id}. Processed ${totalNewEmails} new emails.`);
    return new Response(JSON.stringify({ message: `Sync successful for user ${user_id}` }));

  } catch (e) {
    console.error(`[SYNC-USER] CATASTROPHIC ERROR for user ${user_id}:`, e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
})