// Re-deploy to ensure latest secrets are loaded
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("[CRON-SYNC] Function invoked.");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authorization check
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  const userAgent = req.headers.get('User-Agent');
  
  // --- DEBUG LOGGING ---
  console.log(`[CRON-SYNC-DEBUG] Received Authorization Header: ${authHeader}`);
  console.log(`[CRON-SYNC-DEBUG] Value of CRON_SECRET from env: ${cronSecret ? 'Loaded (length: ' + cronSecret.length + ')' : '!!! NOT LOADED !!!'}`);
  // --- END DEBUG LOGGING ---

  let isAuthorized = false;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true;
    console.log("[CRON-SYNC] Authorized via CRON_SECRET.");
  }

  if (!isAuthorized && userAgent && userAgent.startsWith('pg_net/')) {
    isAuthorized = true;
    console.log("[CRON-SYNC] Authorized via pg_net User-Agent.");
  }

  if (!isAuthorized && authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
      if (permError) {
        console.error("[CRON-SYNC] Error checking permissions:", permError.message);
      } else if (permissions) {
        const permissionNames = permissions.map((p: any) => p.permission_name);
        if (permissionNames.includes('roles.manage') && permissionNames.includes('users.manage')) {
          isAuthorized = true;
          console.log("[CRON-SYNC] Authorized via admin user permissions.");
        }
      }
    } catch (e) {
      console.error("[CRON-SYNC] Error during user permission check:", e.message);
    }
  }

  if (!isAuthorized) {
    console.warn("[CRON-SYNC] Unauthorized access attempt.");
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
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