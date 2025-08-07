import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

serve(async (req) => {
  console.log("[CRON-SYNC] Function invoked.");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authorization check using a custom header to bypass gateway JWT validation
  const receivedSecret = req.headers.get('X-Cron-Secret');
  const cronSecret = Deno.env.get('CRON_SECRET');
  const userAgent = req.headers.get('User-Agent');
  
  console.log(`[CRON-SYNC-DEBUG] Received X-Cron-Secret Header: ${receivedSecret ? 'Present' : 'Missing'}`);
  console.log(`[CRON-SYNC-DEBUG] Value of CRON_SECRET from env: ${cronSecret ? 'Loaded' : '!!! NOT LOADED !!!'}`);

  let isAuthorized = false;

  // Primary auth method: Custom secret header
  if (cronSecret && receivedSecret === cronSecret) {
    isAuthorized = true;
    console.log("[CRON-SYNC] Authorized via X-Cron-Secret header.");
  }

  // Fallback for Supabase's internal scheduler (pg_cron)
  if (!isAuthorized && userAgent && userAgent.startsWith('pg_net/')) {
    isAuthorized = true;
    console.log("[CRON-SYNC] Authorized via pg_net User-Agent.");
  }

  if (!isAuthorized) {
    console.warn("[CRON-SYNC] Unauthorized access attempt.");
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  console.log("[CRON-SYNC] Authorization successful. Starting scheduled email sync for all users.");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('email_accounts')
      .select('user_id');

    if (accountsError) {
      console.error("[CRON-SYNC] Error fetching email accounts:", accountsError);
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      console.log("[CRON-SYNC] No configured email accounts found. Exiting.");
      return new Response(JSON.stringify({ message: "No accounts to sync." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[CRON-SYNC] Found ${accounts.length} accounts to sync.`);

    const syncPromises = accounts.map(account => {
      console.log(`[CRON-SYNC] Invoking sync for user: ${account.user_id}`);
      return supabaseAdmin.functions.invoke('sync-user-emails', {
        body: { user_id: account.user_id },
      });
    });

    const results = await Promise.allSettled(syncPromises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[CRON-SYNC] Failed to invoke sync for user ${accounts[index].user_id}:`, result.reason);
      } else {
        console.log(`[CRON-SYNC] Successfully invoked sync for user ${accounts[index].user_id}.`);
      }
    });

    console.log("[CRON-SYNC] All sync invocations complete.");

    return new Response(JSON.stringify({ message: `Sync process initiated for ${accounts.length} users.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error("[CRON-SYNC] CATASTROPHIC ERROR:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})