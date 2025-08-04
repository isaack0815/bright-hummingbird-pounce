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

    const { id, route_point_id, name, address, weekdays, arrival_time, remarks } = await req.json();
    if (!id || !route_point_id || !name || !address) {
        return new Response(JSON.stringify({ error: 'ID, route_point_id, name, and address are required' }), { status: 400 });
    }

    // Update master stop data in tour_stops table
    const { error: stopUpdateError } = await supabase
      .from('tour_stops')
      .update({ name, address })
      .eq('id', id);
    if (stopUpdateError) throw stopUpdateError;

    // Update route-specific data in tour_route_points table
    const { error: routePointUpdateError } = await supabase
      .from('tour_route_points')
      .update({
        weekdays: weekdays ?? null,
        arrival_time: arrival_time ?? null,
        remarks: remarks ?? null,
      })
      .eq('id', route_point_id);
    if (routePointUpdateError) throw routePointUpdateError;

    return new Response(JSON.stringify({ success: true }), {
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