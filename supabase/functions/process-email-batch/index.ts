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
  console.log("[PROCESS-BATCH] Function invoked.");

  let jobId: number | null = null;
  try {
    const body = await req.json();
    jobId = body.jobId;
    if (!jobId) throw new Error("Job ID is required.");
    console.log(`[PROCESS-BATCH] Received request for Job ID: ${jobId}`);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: job, error: fetchError } = await supabaseAdmin.from('email_sync_jobs').select().eq('id', jobId).single();
    if (fetchError || !job) throw new Error(`Job not found or fetch error: ${fetchError?.message}`);
    console.log("[PROCESS-BATCH] Job details fetched successfully.");

    if (job.status !== 'processing') {
      console.log(`[PROCESS-BATCH] Job status is '${job.status}', not 'processing'. Exiting.`);
      return new Response(JSON.stringify(job), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log("[PROCESS-BATCH] Finding next mailbox to process...");
    const uidsByMailbox: Record<string, number[]> = job.uids_to_process || {};
    const mailboxToProcess = Object.keys(uidsByMailbox).find(key => uidsByMailbox[key].length > 0);
    console.log(`[PROCESS-BATCH] Next mailbox: ${mailboxToProcess}`);

    if (!mailboxToProcess) {
      console.log("[PROCESS-BATCH] No more emails to process. Completing job.");
      const { data: updatedJob } = await supabaseAdmin.from('email_sync_jobs').update({ status: 'completed', uids_to_process: {} }).eq('id', jobId).select().single();
      return new Response(JSON.stringify(updatedJob), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const BATCH_SIZE = 5; // Reduced batch size
    const uidsForMailbox = uidsByMailbox[mailboxToProcess];
    const batchUids = uidsForMailbox.slice(0, BATCH_SIZE);
    console.log(`[PROCESS-BATCH] Processing mailbox '${mailboxToProcess}' with UIDs: ${batchUids.join(', ')}`);

    console.log("[PROCESS-BATCH] Fetching credentials...");
    const { data: creds } = await supabaseAdmin.from('email_accounts').select('imap_username, encrypted_imap_password, iv').eq('user_id', user.id).single();
    if (!creds) throw new Error("Email account not configured.");
    console.log("[PROCESS-BATCH] Credentials fetched.");

    console.log("[PROCESS-BATCH] Decrypting password...");
    const decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, Deno.env.get('APP_ENCRYPTION_KEY')!);
    console.log("[PROCESS-BATCH] Password decrypted.");
    
    const client = new ImapFlow({
        host: Deno.env.get('IMAP_HOST')!,
        port: 993,
        secure: true,
        auth: { user: creds.imap_username, pass: decryptedPassword },
        tls: { rejectUnauthorized: false },
        logger: false
    });
    
    let processedCountInBatch = 0;
    console.log("[PROCESS-BATCH] Connecting to IMAP...");
    await client.connect();
    console.log("[PROCESS-BATCH] IMAP connected.");
    try {
        await client.mailboxOpen(mailboxToProcess);
        const messages = client.fetch(batchUids, { source: true, uid: true });
        
        for await (const msg of messages) {
            if (!msg.source) continue;

            const source = await streamToBuffer(msg.source);
            const parsed = await simpleParser(source);

            const emailData = { user_id: user.id, uid: msg.uid, mailbox: mailboxToProcess, from_address: formatAddress(parsed.from), to_address: formatAddress(parsed.to), subject: parsed.subject, sent_at: parsed.date, body_text: parsed.text, body_html: parsed.html };
            const { data: insertedEmail, error: insertEmailError } = await supabaseAdmin.from('emails').insert(emailData).select('id').single();
            
            if (insertEmailError) {
                console.error(`[PROCESS-BATCH] Failed to insert email UID ${msg.uid}:`, insertEmailError);
                continue;
            }

            if (parsed.attachments && parsed.attachments.length > 0) {
                for (const attachment of parsed.attachments) {
                    if (typeof attachment.content === 'string' || !attachment.filename) continue;
                    const filePath = `${user.id}/${msg.uid}/${attachment.filename}`;
                    await supabaseAdmin.storage.from('email-attachments').upload(filePath, attachment.content, { contentType: attachment.contentType, upsert: true });
                    await supabaseAdmin.from('email_attachments').insert({ email_id: insertedEmail.id, file_name: attachment.filename, file_path: filePath, file_type: attachment.contentType });
                }
            }
            processedCountInBatch++;
        }
    } finally {
        await client.logout();
    }

    // Update the job state
    const remainingUidsInMailbox = uidsForMailbox.slice(processedCountInBatch);
    if (remainingUidsInMailbox.length === 0) {
        delete uidsByMailbox[mailboxToProcess];
    } else {
        uidsByMailbox[mailboxToProcess] = remainingUidsInMailbox;
    }

    const newProcessedCount = job.processed_count + processedCountInBatch;
    const newStatus = Object.keys(uidsByMailbox).length === 0 ? 'completed' : 'processing';
    
    const updatePayload = { uids_to_process: uidsByMailbox, processed_count: newProcessedCount, status: newStatus };
    console.log("[PROCESS-BATCH] Updating job with payload:", updatePayload);

    const { data: updatedJob, error: updateError } = await supabaseAdmin.from('email_sync_jobs').update(updatePayload).eq('id', jobId).select().single();
    if (updateError) throw updateError;
    
    return new Response(JSON.stringify(updatedJob), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error("[PROCESS-BATCH] CATASTROPHIC ERROR:", e);
    if (jobId) {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await supabaseAdmin.from('email_sync_jobs').update({ status: 'failed', error_message: e.message }).eq('id', jobId);
    }
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})