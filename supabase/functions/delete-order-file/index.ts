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
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;
    
    const permissionNames = permissions.map((p: { permission_name: string }) => p.permission_name);
    const isSuperAdmin = permissionNames.includes('roles.manage') && permissionNames.includes('users.manage');
    const hasBillingPermission = permissionNames.includes('Abrechnung Fernverkehr');
    const hasFilePermission = permissionNames.includes('files.manage');

    if (!isSuperAdmin && !hasBillingPermission && !hasFilePermission) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { fileId } = await req.json()
    if (!fileId) {
      return new Response(JSON.stringify({ error: 'File ID is required' }), { status: 400 })
    }

    // 1. Get file path
    const { data: file, error: fetchError } = await supabaseAdmin
      .from('order_files')
      .select('file_path')
      .eq('id', fileId)
      .single()
    if (fetchError) throw fetchError

    // 2. Delete from storage
    const { error: storageError } = await supabaseAdmin.storage.from('order-files').remove([file.file_path])
    if (storageError) throw storageError

    // 3. Delete from database
    const { error: dbError } = await supabaseAdmin.from('order_files').delete().eq('id', fileId)
    if (dbError) throw dbError

    return new Response(null, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 204,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})