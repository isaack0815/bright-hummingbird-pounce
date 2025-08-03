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

    const { orderId, orderData, stops, cargoItems } = await req.json()

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400 })
    }

    if (orderData.status === 'Storniert') {
        // Fetch the current order state from DB
        const { data: currentOrder, error: fetchError } = await supabase
            .from('freight_orders')
            .select('is_billed, lex_invoice_id')
            .eq('id', orderId)
            .single();

        if (fetchError) throw fetchError;

        if (currentOrder.is_billed || currentOrder.lex_invoice_id) {
            return new Response(JSON.stringify({ error: 'Dieser Auftrag wurde bereits abgerechnet und kann nicht storniert werden. Entfernen Sie zuerst die Rechnungszuordnung.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403, // Forbidden
            });
        }
    }

    // Update main order
    const { data: updatedOrder, error: orderError } = await supabase
      .from('freight_orders')
      .update(orderData)
      .eq('id', orderId)
      .select()
      .single()
    if (orderError) throw orderError

    // Delete old stops and cargo, then insert new ones (simple approach)
    await supabase.from('freight_order_stops').delete().eq('order_id', orderId)
    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map((stop: any) => ({ ...stop, order_id: orderId }))
      await supabase.from('freight_order_stops').insert(stopsToInsert)
    }

    await supabase.from('cargo_items').delete().eq('order_id', orderId)
    if (cargoItems && cargoItems.length > 0) {
      const cargoToInsert = cargoItems.map((item: any) => ({ ...item, order_id: orderId }))
      await supabase.from('cargo_items').insert(cargoToInsert)
    }

    return new Response(JSON.stringify({ order: updatedOrder }), {
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