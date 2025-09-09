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
    );

    const { vehicleId } = await req.json();
    if (!vehicleId) {
      return new Response(JSON.stringify({ error: 'Vehicle ID is required' }), { status: 400 });
    }

    // 1. Get the driver ID from the vehicle
    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from('vehicles')
      .select('driver_id')
      .eq('id', vehicleId)
      .single();

    if (vehicleError || !vehicle || !vehicle.driver_id) {
      // No driver assigned, so no active order can be found this way.
      return new Response(JSON.stringify({ order: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 2. Find the most recent active order for that driver
    const { data: order, error: orderError } = await supabaseAdmin
      .from('freight_orders')
      .select('origin_address, destination_address')
      .eq('created_by', vehicle.driver_id) // Assuming the driver is the creator for now
      .in('status', ['Geplant', 'Unterwegs'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (orderError && orderError.code !== 'PGRST116') { // Ignore "no rows found"
      throw orderError;
    }

    return new Response(JSON.stringify({ order: order || null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})