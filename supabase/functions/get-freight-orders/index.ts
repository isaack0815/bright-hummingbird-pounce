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
    // Create a client with the user's auth token to respect RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Fetch all orders the user has access to
    const { data: orders, error: ordersError } = await supabase
      .from('freight_orders')
      .select(`
        *,
        customers (id, company_name),
        freight_order_stops (*),
        cargo_items (*)
      `)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;
    if (!orders) {
        return new Response(JSON.stringify({ orders: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    // 2. Collect unique creator IDs
    const creatorIds = [...new Set(orders.map(order => order.created_by).filter(Boolean))];

    if (creatorIds.length === 0) {
        // No creators to fetch profiles for, return orders as is
        const ordersWithCreator = orders.map(o => ({ ...o, creator: null }));
        return new Response(JSON.stringify({ orders: ordersWithCreator }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    // 3. Fetch profiles for the creators
    // Use service role key to bypass RLS for fetching profiles
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', creatorIds);

    if (profilesError) throw profilesError;

    // 4. Create a map for easy lookup
    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    // 5. Combine orders with creator profiles
    const combinedOrders = orders.map(order => ({
      ...order,
      creator: order.created_by ? profilesMap.get(order.created_by) || null : null,
    }));

    return new Response(JSON.stringify({ orders: combinedOrders }), {
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