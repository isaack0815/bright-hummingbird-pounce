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
    
    const hasPermission = permissions.some((p: { permission_name: string }) => p.permission_name === 'Abrechnung Fernverkehr');
    if (!hasPermission) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const { orderId } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: order, error: orderError } = await supabaseAdmin
      .from('freight_orders')
      .select(`*, customers ( * )`)
      .eq('id', orderId)
      .single()

    if (orderError) throw orderError;

    const { data: lineItems, error: lineItemsError } = await supabaseAdmin
      .from('billing_line_items')
      .select('*')
      .eq('order_id', orderId)
      .order('id');

    if (lineItemsError) throw lineItemsError;

    return new Response(JSON.stringify({ order: { ...order, line_items: lineItems } }), {
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