import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// This function is designed to be run on a schedule (e.g., every 15 minutes).
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authorization check
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  let isAuthorized = false;

  // 1. Check for Cron Secret
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true;
    console.log("[CRON-SYNC] Authorized via CRON_SECRET.");
  }

  // 2. If not authorized by secret, check for admin user permissions
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
        // Using a combination of permissions that indicates a super admin
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

  console.log("[CRON-SYNC] Starting scheduled email sync for all users.");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Find all users with a configured email account
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('email_accounts')
      .select('user_id');

    if (accountsError) {
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      console.log("[CRON-SYNC] No configured email accounts found. Exiting.");
      return new Response(JSON.stringify({ message: "No accounts to sync." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[CRON-SYNC] Found ${accounts.length} accounts to sync.`);

    // 2. Invoke the sync function for each user individually
    const syncPromises = accounts.map(account => {
      console.log(`[CRON-SYNC] Invoking sync for user: ${account.user_id}`);
      return supabaseAdmin.functions.invoke('sync-user-emails', {
        body: { user_id: account.user_id },
      });
    });

    // We use Promise.allSettled to ensure that one failed sync doesn't stop others.
    const results = await Promise.allSettled(syncPromises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[CRON-SYNC] Failed to sync emails for user ${accounts[index].user_id}:`, result.reason);
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