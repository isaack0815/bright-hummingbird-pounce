import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow@1.0.155';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const b64_to_ab = (b64: string) => { const byteString = Buffer.from(b64, "base64").toString("binary"); const len = byteString.length; const bytes = new Uint8Array(len); for (let i = 0; i < len; i++) { bytes[i] = byteString.charCodeAt(i); } return bytes.buffer; };
const hex_to_ab = (hex: string) => { const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16))); return typedArray.buffer; };
async function decrypt(encryptedData: string, iv_b64: string, key_hex: string): Promise<string> { const keyBuffer = hex_to_ab(key_hex); const key = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]); const iv = new Uint8Array(b64_to_ab(iv_b64)); const data = new Uint8Array(b64_to_ab(encryptedData)); const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data); return new TextDecoder().decode(decrypted); }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  
  const log = async (status: string, details: string, jobId: number | null = null) => {
    await supabaseAdmin.from('email_sync_cron_logs').insert({ status, details, job_id: jobId });
  };

  const receivedSecret = req.headers.get('X-Cron-Secret');
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || receivedSecret !== cronSecret) {
    await log('error', 'Unauthorized attempt to run cron job.');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  try {
    await log('started', 'Cron job started.');
    const encryptionKey = Deno.env.get('APP_ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error("APP_ENCRYPTION_KEY secret is not set.");

    const { data: accounts, error: accountsError } = await supabaseAdmin.from('email_accounts').select('*');
    if (accountsError) throw accountsError;
    if (!accounts || accounts.length === 0) {
      await log('completed', 'No accounts to sync.');
      return new Response(JSON.stringify({ message: "No accounts to sync." }), { headers: corsHeaders });
    }

    let jobsCreated = 0;
    let workerInvoked = false;

    for (const account of accounts) {
      const { data: existingJob } = await supabaseAdmin.from('email_sync_jobs').select('id').eq('user_id', account.user_id).in('status', ['pending', 'processing']).limit(1).single();
      if (existingJob) {
        console.log(`[CRON-PLANNER] Skipping user ${account.user_id}, existing job found.`);
        continue;
      }

      const decryptedPassword = await decrypt(account.encrypted_imap_password, account.iv, encryptionKey);
      const client = new ImapFlow({ host: Deno.env.get('IMAP_HOST')!, port: 993, secure: true, auth: { user: account.imap_username, pass: decryptedPassword }, tls: { rejectUnauthorized: false }, logger: false });
      
      await client.connect();
      try {
        const mailboxes = await client.list();
        for (const mailbox of mailboxes) {
          if (mailbox.flags.has('\\Noselect')) continue;
          await client.mailboxOpen(mailbox.path);
          const { data: existingEmails } = await supabaseAdmin.from('emails').select('uid').eq('user_id', account.user_id).eq('mailbox', mailbox.path);
          const existingUids = new Set((existingEmails || []).map(e => e.uid));
          const serverUids = await client.search({ all: true });
          const newUids = serverUids.filter(uid => !existingUids.has(uid));

          if (newUids.length > 0) {
            const { data: newJob, error: insertError } = await supabaseAdmin.from('email_sync_jobs').insert({
              user_id: account.user_id,
              status: 'pending',
              mailbox: mailbox.path,
              uids_to_process: newUids,
              total_count: newUids.length,
            }).select('id').single();

            if (insertError) throw insertError;

            await log('job_created', `Created job for user ${account.user_id} in mailbox ${mailbox.path} with ${newUids.length} emails.`, newJob.id);
            jobsCreated++;
            if (!workerInvoked) {
              try {
                await log('invoking_worker', 'Attempting to invoke process-email-batch asynchronously.');
                const { error: invokeError } = await supabaseAdmin.functions.invoke('process-email-batch', { 
                  body: {},
                  headers: {
                    'Prefer': 'respond-async'
                  }
                });
                
                if (invokeError) {
                  await log('worker_invoke_error', `Error invoking worker: ${invokeError.message}`);
                  console.error("Error invoking worker:", invokeError);
                } else {
                  workerInvoked = true;
                  await log('worker_invoked', `Worker function process-email-batch was invoked successfully (async).`);
                }
              } catch (e) {
                  await log('worker_invoke_exception', `Exception during worker invocation: ${e.message}`);
                  console.error("Exception during worker invocation:", e);
              }
            }
          }
        }
      } finally {
        await client.logout();
      }
    }
    
    await log('completed', `Cron run finished. Created ${jobsCreated} new sync jobs.`);
    return new Response(JSON.stringify({ message: `Created ${jobsCreated} new sync jobs.` }), { headers: corsHeaders });
  } catch (e) {
    await log('error', `Cron job failed: ${e.message}`);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});