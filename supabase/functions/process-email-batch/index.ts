import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow';
import { simpleParser } from 'npm:mailparser';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";
globalThis.Buffer = Buffer;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { jobId } = await req.json();
    if (!jobId) throw new Error("Job ID is required.");

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: job, error: fetchError } = await supabaseAdmin.from('email_sync_jobs').select().eq('id', jobId).single();
    if (fetchError || !job) throw new Error("Job not found.");
    if (job.status !== 'processing') return new Response(JSON.stringify(job), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const BATCH_SIZE = 10;
    let uids_to_process: number[] = job.uids_to_process || [];
    const batchUids = uids_to_process.slice(0, BATCH_SIZE);
    if (batchUids.length === 0) {
        const { data: updatedJob } = await supabaseAdmin.from('email_sync_jobs').update({ status: 'completed' }).eq('id', jobId).select().single();
        return new Response(JSON.stringify(updatedJob), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: creds } = await supabaseAdmin.from('email_accounts').select('imap_username, encrypted_imap_password, iv').eq('user_id', user.id).single();
    if (!creds) throw new Error("Email account not configured.");
    const decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, Deno.env.get('APP_ENCRYPTION_KEY')!);
    
    const client = new ImapFlow({
        host: Deno.env.get('IMAP_HOST')!,
        port: 993,
        secure: true,
        auth: { user: creds.imap_username, pass: decryptedPassword },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    await client.connect();
    let processedCountInBatch = 0;
    try {
        await client.mailboxOpen('INBOX');
        for await (const msg of client.fetch(batchUids.join(','), { source: true, uid: true })) {
            const source = await streamToBuffer(msg.source);
            const parsed = await simpleParser(source);
            const uid = msg.uid;

            const { data: insertedEmail, error: insertEmailError } = await supabaseAdmin.from('emails').insert({ user_id: user.id, uid, mailbox: 'INBOX', from_address: formatAddress(parsed.from), to_address: formatAddress(parsed.to), subject: parsed.subject, sent_at: parsed.date, body_text: parsed.text, body_html: parsed.html }).select('id').single();
            if (insertEmailError) {
                console.error(`Error inserting email UID ${uid}:`, insertEmailError);
                continue;
            }

            if (parsed.attachments && parsed.attachments.length > 0) {
                for (const attachment of parsed.attachments) {
                    if (!attachment.filename) continue;
                    const filePath = `${user.id}/${uid}/${attachment.filename}`;
                    await supabaseAdmin.storage.from('email-attachments').upload(filePath, attachment.content, { contentType: attachment.contentType, upsert: true });
                    await supabaseAdmin.from('email_attachments').insert({ email_id: insertedEmail.id, file_name: attachment.filename, file_path: filePath, file_type: attachment.contentType });
                }
            }
            processedCountInBatch++;
        }
    } finally {
        await client.logout();
    }

    const remainingUids = uids_to_process.slice(processedCountInBatch);
    const newProcessedCount = job.processed_count + processedCountInBatch;
    const newStatus = remainingUids.length === 0 ? 'completed' : 'processing';

    const { data: updatedJob, error: updateError } = await supabaseAdmin.from('email_sync_jobs').update({ uids_to_process: remainingUids, processed_count: newProcessedCount, status: newStatus }).eq('id', jobId).select().single();
    if (updateError) throw updateError;

    return new Response(JSON.stringify(updatedJob), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error("Batch process error:", e);
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})