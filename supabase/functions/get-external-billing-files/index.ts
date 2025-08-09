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
    // 1. Check user permissions
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;
    
    const permissionNames = permissions.map((p: { permission_name: string }) => p.permission_name);
    const hasPermission = permissionNames.includes('Abrechnung Fernverkehr');

    if (!hasPermission) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    // 2. Get orderId from request
    const { orderId } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400, headers: corsHeaders });
    }

    // 3. Fetch files using admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseAdmin
      .from('order_files')
      .select('id, file_name, file_path')
      .eq('order_id', orderId)
      .in('file_name', [`CMR_${orderId}.pdf`, `Eingangsrechnung_${orderId}.pdf`]);

    if (error) throw error;

    return new Response(JSON.stringify({ files: data }), {
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