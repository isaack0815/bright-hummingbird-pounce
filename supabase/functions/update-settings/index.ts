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
    // Create a client with the user's auth token to check permissions
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Check if the user has the required permission
    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;
    
    const permissionNames = permissions.map((p: { permission_name: string }) => p.permission_name);
    const isSuperAdmin = permissionNames.includes('roles.manage') && permissionNames.includes('users.manage');
    const hasPermission = permissionNames.includes('settings.manage');

    if (!isSuperAdmin && !hasPermission) {
        return new Response(JSON.stringify({ error: 'Forbidden: You do not have permission to manage settings.' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403 
        });
    }

    // Create an admin client to perform the upsert, bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const settingsToUpdate = await req.json() // Expects an array of { key: string, value: string }

    if (!Array.isArray(settingsToUpdate)) {
        return new Response(JSON.stringify({ error: 'Request body must be an array of settings' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
        })
    }

    const upsertPromises = settingsToUpdate.map(setting => 
        supabaseAdmin.from('settings').upsert(setting)
    )

    const results = await Promise.all(upsertPromises)
    const firstError = results.find(res => res.error)

    if (firstError && firstError.error) throw firstError.error

    return new Response(JSON.stringify({ success: true }), {
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