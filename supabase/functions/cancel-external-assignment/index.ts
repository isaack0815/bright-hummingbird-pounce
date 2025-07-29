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

    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { status: 400 })
    }

    // 1. Reset external assignment fields on the order
    const { data, error: updateError } = await supabaseAdmin
      .from('freight_orders')
      .update({
        is_external: false,
        external_company_address: null,
        external_email: null,
        external_driver_name: null,
        external_driver_phone: null,
        external_license_plate: null,
        external_transporter_dimensions: null,
        payment_term_days: null,
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) throw updateError

    // 2. Archive the associated transport order PDF
    await supabaseAdmin
      .from('order_files')
      .update({ is_archived: true })
      .eq('order_id', orderId)
      .like('file_name', 'Transportauftrag_%');

    return new Response(JSON.stringify({ order: data }), {
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