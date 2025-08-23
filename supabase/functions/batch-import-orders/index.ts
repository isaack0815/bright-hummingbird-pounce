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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { customerId, orders } = await req.json()

    if (!customerId || !Array.isArray(orders) || orders.length === 0) {
      return new Response(JSON.stringify({ error: 'Customer ID and a non-empty orders array are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const ordersToInsert = orders.map(order => ({
      customer_id: customerId,
      external_order_number: order.external_order_number || null,
      status: 'Angelegt', // Default status
      origin_address: order.origin_address || null,
      pickup_date: order.pickup_date || null,
      destination_address: order.destination_address || null,
      delivery_date: order.delivery_date || null,
      price: order.price ? Number(order.price) : null,
      description: order.description || null,
    }));

    const results = await Promise.allSettled(
      ordersToInsert.map(order => 
        supabaseAdmin.from('freight_orders').insert(order).select('id').single()
      )
    );

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && !result.value.error) {
        successCount++;
      } else {
        errorCount++;
        const errorMessage = result.status === 'rejected' 
          ? result.reason.message 
          : result.value.error.message;
        errors.push(`Order ${index + 1}: ${errorMessage}`);
      }
    });

    return new Response(JSON.stringify({ 
      successCount, 
      errorCount, 
      totalCount: orders.length,
      errors 
    }), {
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