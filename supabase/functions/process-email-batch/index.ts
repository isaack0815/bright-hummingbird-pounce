import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow@1.0.155';
import { simpleParser } from 'npm:mailparser';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 5;

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

serve(async (_req) => {
  if (_req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let jobId: number | null = null;

  try {
    const encryptionKey = Deno.env.get('APP_ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error("APP_ENCRYPTION_KEY secret is not set.");

    const { data: job, error: jobError } = await supabaseAdmin.from('email_sync_jobs').select('*').eq('status', 'pending').limit(1).single();
    if (jobError || !job) {
      return new Response(JSON.stringify({ message: "No pending jobs." }), { headers: corsHeaders });
    }
    jobId = job.id;

    await supabaseAdmin.from('email_sync_jobs').update({ status: 'processing' }).eq('id', job.id);

    if (!job.mailbox) {
      throw new Error(`Job ${job.id} is missing a mailbox path.`);
    }

    const { data: account, error: accountError } = await supabaseAdmin.from('email_accounts').select('*').eq('user_id', job.user_id).single();
    if (accountError || !account) throw new Error(`Account for user ${job.user_id} not found.`);

    const decryptedPassword = await decrypt(account.encrypted_imap_password, account.iv, encryptionKey);
    const client = new ImapFlow({ host: Deno.env.get('IMAP_HOST')!, port: 993, secure: true, auth: { user: account.imap_username, pass: decryptedPassword }, tls: { rejectUnauthorized: false }, logger: false });

    let processedInThisRun = 0;
    try {
      await client.connect();
      const uids = Array.isArray(job.uids_to_process) ? job.uids_to_process : JSON.parse(job.uids_to_process || '[]');
      const uidsToProcessNow = uids.slice(job.processed_count, job.processed_count + BATCH_SIZE);

      if (uidsToProcessNow.length > 0) {
        await client.mailboxOpen(job.mailbox);
        const messages = client.fetch(uidsToProcessNow, { source: true, uid: true });
        for await (const msg of messages) {
            if (!msg.source) continue;
            const source = await streamToBuffer(msg.source);
            const parsed = await simpleParser(source);
            const emailData = { user_id: job.user_id, uid: msg.uid, mailbox: job.mailbox, from_address: formatAddress(parsed.from), to_address: formatAddress(parsed.to), subject: parsed.subject, sent_at: parsed.date, body_text: parsed.text, body_html: parsed.html };
            const { data: insertedEmail, error: insertEmailError } = await supabaseAdmin.from('emails').insert(emailData).select('id').single();
            if (insertEmailError) { console.error(`[WORKER] Failed to insert email UID ${msg.uid}:`, insertEmailError); continue; }
            if (parsed.attachments && parsed.attachments.length > 0) {
                for (const attachment of parsed.attachments) {
                    if (typeof attachment.content === 'string' || !attachment.filename) continue;
                    const filePath = `${job.user_id}/${insertedEmail.id}/${attachment.filename}`;
                    await supabaseAdmin.storage.from('email-attachments').upload(filePath, attachment.content, { contentType: attachment.contentType, upsert: true });
                    await supabaseAdmin.from('email_attachments').insert({ email_id: insertedEmail.id, file_name: attachment.filename, file_path: filePath, file_type: attachment.contentType });
                }
            }
            processedInThisRun++;
        }
      }
    } finally {
      await client.logout();
    }

    const newProcessedCount = job.processed_count + processedInThisRun;
    const isCompleted = newProcessedCount >= job.total_count;
    await supabaseAdmin.from('email_sync_jobs').update({
      status: isCompleted ? 'completed' : 'pending',
      processed_count: newProcessedCount,
    }).eq('id', job.id);

    if (!isCompleted && uidsToProcessNow.length > 0) {
      supabaseAdmin.functions.invoke('process-email-batch', { 
        body: {},
        headers: {
          'Prefer': 'respond-async'
        }
      }).catch(console.error);
    }

    return new Response(JSON.stringify({ message: `Processed ${processedInThisRun} emails for job ${job.id}.` }), { headers: corsHeaders });
  } catch (e) {
    if (jobId) {
      await supabaseAdmin.from('email_sync_jobs').update({ status: 'failed', error_message: e.message }).eq('id', jobId);
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});