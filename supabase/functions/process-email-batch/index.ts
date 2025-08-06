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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  console.log("[PROCESS-EMAIL-BATCH] Function invoked.");

  let jobId: number | null = null;
  try {
    const body = await req.json();
    jobId = body.jobId;
    console.log(`[PROCESS-EMAIL-BATCH] Received request for Job ID: ${jobId}`);
    if (!jobId) throw new Error("Job ID is required.");

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");
    console.log(`[PROCESS-EMAIL-BATCH] Authenticated user: ${user.id}`);

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    console.log(`[PROCESS-EMAIL-BATCH] Fetching job details for job ${jobId}...`);
    const { data: job, error: fetchError } = await supabaseAdmin.from('email_sync_jobs').select().eq('id', jobId).single();
    if (fetchError || !job) throw new Error(`Job not found or fetch error: ${fetchError?.message}`);
    console.log("[PROCESS-EMAIL-BATCH] Job details fetched:", job);

    if (job.status !== 'processing') {
      console.log(`[PROCESS-EMAIL-BATCH] Job status is '${job.status}', not 'processing'. Exiting.`);
      return new Response(JSON.stringify(job), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const BATCH_SIZE = 10;
    let uids_to_process: number[] = job.uids_to_process || [];
    const batchUids = uids_to_process.slice(0, BATCH_SIZE);
    console.log(`[PROCESS-EMAIL-BATCH] UIDs to process in this batch: ${batchUids.join(', ')}`);

    if (batchUids.length === 0) {
        console.log("[PROCESS-EMAIL-BATCH] No UIDs in batch. Completing job.");
        const { data: updatedJob } = await supabaseAdmin.from('email_sync_jobs').update({ status: 'completed' }).eq('id', jobId).select().single();
        return new Response(JSON.stringify(updatedJob), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log("[PROCESS-EMAIL-BATCH] Fetching email account credentials...");
    const { data: creds } = await supabaseAdmin.from('email_accounts').select('imap_username, encrypted_imap_password, iv').eq('user_id', user.id).single();
    if (!creds) throw new Error("Email account not configured.");
    console.log("[PROCESS-EMAIL-BATCH] Credentials found. Decrypting password...");
    const decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, Deno.env.get('APP_ENCRYPTION_KEY')!);
    console.log("[PROCESS-EMAIL-BATCH] Password decrypted.");
    
    const client = new ImapFlow({
        host: Deno.env.get('IMAP_HOST')!,
        port: 993,
        secure: true,
        auth: { user: creds.imap_username, pass: decryptedPassword },
        tls: { rejectUnauthorized: false },
        logger: false // Set to true for extremely verbose IMAP command logging
    });
    
    let processedCountInBatch = 0;
    console.log("[PROCESS-EMAIL-BATCH] Connecting to IMAP server...");
    await client.connect();
    console.log("[PROCESS-EMAIL-BATCH] IMAP client connected.");
    try {
        console.log("[PROCESS-EMAIL-BATCH] Opening INBOX...");
        await client.mailboxOpen('INBOX');
        console.log("[PROCESS-EMAIL-BATCH] INBOX opened.");
        
        console.log(`[PROCESS-EMAIL-BATCH] Fetching source for UIDs: ${batchUids.join(', ')}`);
        const messages = client.fetch(batchUids, { source: true, uid: true });
        for await (const msg of messages) {
            console.log(`[PROCESS-EMAIL-BATCH] Processing UID: ${msg.uid}`);
            if (!msg.source) {
                console.log(`[PROCESS-EMAIL-BATCH] No source for UID ${msg.uid}, skipping.`);
                continue;
            }

            const source = await streamToBuffer(msg.source);
            const parsed = await simpleParser(source);
            console.log(`[PROCESS-EMAIL-BATCH] Parsed email from UID ${msg.uid}. Subject: ${parsed.subject}`);

            const emailData = { user_id: user.id, uid: msg.uid, mailbox: 'INBOX', from_address: formatAddress(parsed.from), to_address: formatAddress(parsed.to), subject: parsed.subject, sent_at: parsed.date, body_text: parsed.text, body_html: parsed.html };
            console.log(`[PROCESS-EMAIL-BATCH] Inserting email data for UID ${msg.uid}:`, emailData);
            const { data: insertedEmail, error: insertEmailError } = await supabaseAdmin.from('emails').insert(emailData).select('id').single();
            
            if (insertEmailError) {
                console.error(`[PROCESS-EMAIL-BATCH] Failed to insert email with UID ${msg.uid}:`, insertEmailError);
                continue; // Skip to next email on insertion error
            }
            console.log(`[PROCESS-EMAIL-BATCH] Successfully inserted email for UID ${msg.uid}. New email ID: ${insertedEmail.id}`);

            if (parsed.attachments && parsed.attachments.length > 0) {
                console.log(`[PROCESS-EMAIL-BATCH] Found ${parsed.attachments.length} attachments for UID ${msg.uid}.`);
                for (const attachment of parsed.attachments) {
                    if (typeof attachment.content === 'string' || !attachment.filename) {
                        console.log(`[PROCESS-EMAIL-BATCH] Skipping invalid attachment for UID ${msg.uid}.`);
                        continue;
                    }
                    const filePath = `${user.id}/${msg.uid}/${attachment.filename}`;
                    console.log(`[PROCESS-EMAIL-BATCH] Uploading attachment to storage: ${filePath}`);
                    const { error: uploadError } = await supabaseAdmin.storage.from('email-attachments').upload(filePath, attachment.content, { contentType: attachment.contentType, upsert: true });
                    if (uploadError) {
                        console.error(`[PROCESS-EMAIL-BATCH] Failed to upload attachment ${attachment.filename}:`, uploadError);
                        continue;
                    }
                    console.log(`[PROCESS-EMAIL-BATCH] Uploaded attachment ${attachment.filename}. Inserting metadata...`);
                    const { error: insertAttachmentError } = await supabaseAdmin.from('email_attachments').insert({ email_id: insertedEmail.id, file_name: attachment.filename, file_path: filePath, file_type: attachment.contentType });
                    if (insertAttachmentError) {
                        console.error(`[PROCESS-EMAIL-BATCH] Failed to insert attachment metadata for ${attachment.filename}:`, insertAttachmentError);
                    } else {
                        console.log(`[PROCESS-EMAIL-BATCH] Successfully inserted attachment metadata for ${attachment.filename}.`);
                    }
                }
            }
            processedCountInBatch++;
        }
    } finally {
        console.log("[PROCESS-EMAIL-BATCH] Logging out from IMAP server...");
        await client.logout();
        console.log("[PROCESS-EMAIL-BATCH] IMAP logout successful.");
    }

    const remainingUids = uids_to_process.slice(processedCountInBatch);
    const newProcessedCount = job.processed_count + processedCountInBatch;
    const newStatus = remainingUids.length === 0 ? 'completed' : 'processing';
    
    const updatePayload = { uids_to_process: remainingUids, processed_count: newProcessedCount, status: newStatus };
    console.log("[PROCESS-EMAIL-BATCH] Updating job with payload:", updatePayload);

    const { data: updatedJob, error: updateError } = await supabaseAdmin.from('email_sync_jobs').update(updatePayload).eq('id', jobId).select().single();
    if (updateError) throw updateError;
    
    console.log("[PROCESS-EMAIL-BATCH] Job updated successfully. Final job state:", updatedJob);
    return new Response(JSON.stringify(updatedJob), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error("[PROCESS-EMAIL-BATCH] CATASTROPHIC ERROR:", e);
    if (jobId) {
        console.log(`[PROCESS-EMAIL-BATCH] Attempting to mark job ${jobId} as failed.`);
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await supabaseAdmin.from('email_sync_jobs').update({ status: 'failed', error_message: e.message }).eq('id', jobId);
        console.log(`[PROCESS-EMAIL-BATCH] Job ${jobId} marked as failed.`);
    }
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})