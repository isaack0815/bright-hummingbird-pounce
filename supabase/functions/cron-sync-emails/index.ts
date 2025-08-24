import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Content-Type': 'application/json',
}

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
  const authHeader = req.headers.get('Authorization');

  // Authorize if it's a valid cron job OR a request from an authenticated user
  if ((!cronSecret || receivedSecret !== cronSecret) && !authHeader) {
    await log('error', 'Unauthorized attempt to run cron job.');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const triggerSource = authHeader ? 'manual_user' : 'cron_secret';

  try {
    await log('started', `Cron job planner started. Triggered by: ${triggerSource}`);

    const { data: accounts, error: accountsError } = await supabaseAdmin.from('email_accounts').select('user_id');
    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      await log('completed', 'No accounts to plan jobs for.');
      return new Response(JSON.stringify({ message: "No accounts to sync." }), { headers: corsHeaders });
    }

    let jobsCreated = 0;
    for (const account of accounts) {
      const { data: existingJob, error: existingJobError } = await supabaseAdmin
        .from('email_sync_jobs')
        .select('id')
        .eq('user_id', account.user_id)
        .in('status', ['pending', 'processing'])
        .limit(1)
        .single();

      if (existingJobError && existingJobError.code !== 'PGRST116') { // Ignore 'No rows found' error
        throw existingJobError;
      }

      if (existingJob) {
        console.log(`[CRON-PLANNER] Skipping user ${account.user_id}, active job found.`);
        continue;
      }

      const { data: newJob, error: insertError } = await supabaseAdmin.from('email_sync_jobs').insert({
        user_id: account.user_id,
        status: 'pending',
        total_count: 0,
        processed_count: 0,
      }).select('id').single();

      if (insertError) throw insertError;

      await log('job_created', `Created job for user ${account.user_id}.`, newJob.id);
      jobsCreated++;
    }
    
    if (jobsCreated > 0) {
        console.log(`[CRON-PLANNER] ${jobsCreated} jobs created. Invoking worker...`);
        // Asynchronously invoke the worker to start the processing chain.
        supabaseAdmin.functions.invoke('process-email-batch', { 
            body: {},
            headers: { 'Prefer': 'respond-async' }
        }).catch(console.error);
        await log('worker_invoked', 'Worker invocation initiated.');
    }

    await log('completed', `Cron planner finished. Created ${jobsCreated} new sync jobs.`);
    return new Response(JSON.stringify({ message: `Created ${jobsCreated} new sync jobs.` }), { headers: corsHeaders });
  } catch (e) {
    await log('error', `Cron planner failed: ${e.message}`);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});