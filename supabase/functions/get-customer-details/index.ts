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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { id } = await req.json()
    if (!id) {
      return new Response(JSON.stringify({ error: 'Customer ID is required' }), { status: 400 })
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()
    if (customerError) throw customerError

    const { data: orders, error: ordersError } = await supabase
      .from('freight_orders')
      .select('*, customers(company_name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
    if (ordersError) throw ordersError

    if (!orders || orders.length === 0) {
        return new Response(JSON.stringify({ customer, orders: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    const creatorIds = [...new Set(orders.map(order => order.created_by).filter(Boolean))];

    if (creatorIds.length === 0) {
        const ordersWithCreator = orders.map(o => ({ ...o, creator: null }));
        return new Response(JSON.stringify({ customer, orders: ordersWithCreator }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', creatorIds);

    if (profilesError) throw profilesError;

    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    const combinedOrders = orders.map(order => ({
      ...order,
      creator: order.created_by ? profilesMap.get(order.created_by) || null : null,
    }));

    return new Response(JSON.stringify({ customer, orders: combinedOrders }), {
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