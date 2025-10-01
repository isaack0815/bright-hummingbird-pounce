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

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
    }

    const { data: garnishments, error: garnishmentsError } = await supabaseAdmin
      .from('garnishments_with_details')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (garnishmentsError) throw garnishmentsError;

    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('garnishment_payments')
      .select('*')
      .in('garnishment_id', garnishments.map(g => g.id));

    if (paymentsError) throw paymentsError;

    const garnishmentsWithPayments = garnishments.map(g => ({
      ...g,
      payments: payments.filter(p => p.garnishment_id === g.id).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()),
    }));

    return new Response(JSON.stringify({ garnishments: garnishmentsWithPayments }), {
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