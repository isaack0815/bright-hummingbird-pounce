import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";
globalThis.Buffer = Buffer;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decryption logic
const b64_to_ab = (b64: string) => { const byteString = Buffer.from(b64, "base64").toString("binary"); const len = byteString.length; const bytes = new Uint8Array(len); for (let i = 0; i < len; i++) { bytes[i] = byteString.charCodeAt(i); } return bytes.buffer; };
const hex_to_ab = (hex: string) => { const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16))); return typedArray.buffer; };
async function decrypt(encryptedData: string, iv_b64: string, key_hex: string): Promise<string> { const keyBuffer = hex_to_ab(key_hex); const key = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]); const iv = new Uint8Array(b64_to_ab(iv_b64)); const data = new Uint8Array(b64_to_ab(encryptedData)); const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data); return new TextDecoder().decode(decrypted); }


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  console.log("[CREATE-JOB] Function invoked.");

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");
    console.log(`[CREATE-JOB] Authenticated user: ${user.id}`);

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    console.log("[CREATE-JOB] Fetching credentials...");
    const { data: creds } = await supabaseAdmin.from('email_accounts').select('imap_username, encrypted_imap_password, iv').eq('user_id', user.id).single();
    if (!creds) throw new Error("Email account not configured.");
    const decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, Deno.env.get('APP_ENCRYPTION_KEY')!);
    console.log("[CREATE-JOB] Credentials decrypted.");

    console.log("[CREATE-JOB] Fetching existing UIDs from DB...");
    const { data: existingEmails, error: dbError } = await supabaseAdmin.from('emails').select('uid, mailbox').eq('user_id', user.id);
    if (dbError) throw dbError;
    
    // Group existing UIDs by mailbox for efficient lookup
    const existingUidsByMailbox = existingEmails.reduce((acc, email) => {
      if (!acc[email.mailbox]) {
        acc[email.mailbox] = new Set();
      }
      acc[email.mailbox].add(email.uid);
      return acc;
    }, {} as Record<string, Set<number>>);
    console.log(`[CREATE-JOB] Found existing UIDs in ${Object.keys(existingUidsByMailbox).length} mailboxes.`);

    const client = new ImapFlow({
        host: Deno.env.get('IMAP_HOST')!,
        port: 993,
        secure: true,
        auth: { user: creds.imap_username, pass: decryptedPassword },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    const uidsToProcess: Record<string, number[]> = {};
    let totalNewUids = 0;

    console.log("[CREATE-JOB] Connecting to IMAP to scan mailboxes...");
    await client.connect();
    try {
        const mailboxes = await client.list();
        console.log(`[CREATE-JOB] Found ${mailboxes.length} mailboxes to scan.`);
        for (const mailbox of mailboxes) {
            if (mailbox.flags.has('\\Noselect')) {
                console.log(`[CREATE-JOB] Skipping non-selectable mailbox: ${mailbox.path}`);
                continue;
            }
            console.log(`[CREATE-JOB] Scanning mailbox: ${mailbox.path}`);
            await client.mailboxOpen(mailbox.path);
            const serverUids = await client.search({ all: true });
            
            const existingUidsForMailbox = existingUidsByMailbox[mailbox.path] || new Set();
            const newUids = serverUids.filter(uid => !existingUidsForMailbox.has(uid));

            if (newUids.length > 0) {
                console.log(`[CREATE-JOB] Found ${newUids.length} new UIDs in ${mailbox.path}.`);
                uidsToProcess[mailbox.path] = newUids;
                totalNewUids += newUids.length;
            }
        }
    } finally {
        await client.logout();
        console.log("[CREATE-JOB] IMAP logout successful.");
    }

    if (totalNewUids === 0) {
        console.log("[CREATE-JOB] No new emails found across all mailboxes.");
        return new Response(JSON.stringify({ message: "No new emails." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[CREATE-JOB] Total new emails to sync: ${totalNewUids}. Creating job...`);
    const { data: job, error: jobError } = await supabaseAdmin
      .from('email_sync_jobs')
      .insert({
        user_id: user.id,
        status: 'processing',
        uids_to_process: uidsToProcess, // Storing the JSON object
        total_count: totalNewUids,
        processed_count: 0,
      })
      .select()
      .single();

    if (jobError) throw jobError;
    console.log("[CREATE-JOB] Job created successfully:", job);

    return new Response(JSON.stringify(job), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error("[CREATE-JOB] CATASTROPHIC ERROR:", e);
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})