import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Permission check
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;
    
    const permissionNames = permissions.map((p: any) => p.permission_name);
    const isSuperAdmin = permissionNames.includes('roles.manage') && permissionNames.includes('users.manage');
    const hasPermission = permissionNames.includes('settings.manage');

    if (!isSuperAdmin && !hasPermission) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    // Fetch latest data from origin
    const fetchCommand = new Deno.Command("git", { args: ["fetch"] });
    await fetchCommand.output();

    // Check status
    const statusCommand = new Deno.Command("git", { args: ["status", "-uno"] });
    const { stdout: statusOutput } = await statusCommand.output();
    const statusText = new TextDecoder().decode(statusOutput);

    const updateAvailable = statusText.includes("Your branch is behind");

    return new Response(JSON.stringify({ updateAvailable, statusText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})