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

    const { orderData, stops, cargoItems } = await req.json()

    // Insert the main order
    const { data: newOrder, error: orderError } = await supabase
      .from('freight_orders')
      .insert(orderData)
      .select()
      .single()

    if (orderError) throw orderError

    // Insert stops if they exist
    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map((stop: any) => ({ ...stop, order_id: newOrder.id }))
      const { error: stopsError } = await supabase.from('freight_order_stops').insert(stopsToInsert)
      if (stopsError) throw stopsError
    }

    // Insert cargo items if they exist
    if (cargoItems && cargoItems.length > 0) {
      const cargoToInsert = cargoItems.map((item: any) => ({ ...item, order_id: newOrder.id }))
      const { error: cargoError } = await supabase.from('cargo_items').insert(cargoToInsert)
      if (cargoError) throw cargoError
    }

    return new Response(JSON.stringify({ order: newOrder }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})