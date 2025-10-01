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

    const { garnishment_id, payment_date, amount, notes } = await req.json();
    if (!garnishment_id || !payment_date || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('garnishment_payments')
      .insert({ garnishment_id, payment_date, amount, notes })
      .select()
      .single();

    if (error) throw error;

    // Check if the garnishment is now fully paid
    const { data: details, error: detailsError } = await supabaseAdmin
      .from('garnishments_with_details')
      .select('remaining_amount')
      .eq('id', garnishment_id)
      .single();
      
    if (detailsError) throw detailsError;

    if (details.remaining_amount <= 0) {
      await supabaseAdmin
        .from('garnishments')
        .update({ status: 'closed' })
        .eq('id', garnishment_id);
    }

    return new Response(JSON.stringify({ payment: data }), {
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