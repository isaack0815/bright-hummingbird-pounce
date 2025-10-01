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
    // Check permissions
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;
    
    const permissionNames = permissions.map((p: { permission_name: string }) => p.permission_name);
    const isSuperAdmin = permissionNames.includes('roles.manage') && permissionNames.includes('users.manage');
    const hasPermission = permissionNames.includes('settings.manage');

    if (!isSuperAdmin && !hasPermission) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for secrets
    const secrets = [
        'IMAP_HOST',
        'SMTP_HOST', 
        'SMTP_PORT', 
        'SMTP_USER', 
        'SMTP_PASS', 
        'SMTP_FROM_EMAIL',
        'SMTP_SECURE'
    ];
    
    const status = secrets.reduce((acc, secret) => {
        (acc as any)[secret] = !!Deno.env.get(secret);
        return acc;
    }, {} as Record<string, boolean>);

    return new Response(JSON.stringify({ status }), {
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