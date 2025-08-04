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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role for transaction-like behavior
    )

    const { id, name, description, stops, vehicle_id } = await req.json();
    if (!name || !stops) {
        return new Response(JSON.stringify({ error: 'Name and stops are required' }), { status: 400 });
    }

    let tourId = id;
    const tourData = { name, description, vehicle_id: vehicle_id || null };

    // 1. Upsert the tour itself
    if (tourId) {
      // Update existing tour
      const { error } = await supabase.from('tours').update(tourData).eq('id', tourId);
      if (error) throw error;
    } else {
      // Create new tour
      const { data, error } = await supabase.from('tours').insert(tourData).select('id').single();
      if (error) throw error;
      tourId = data.id;
    }

    // 2. Delete existing route points for this tour
    const { error: deleteError } = await supabase.from('tour_route_points').delete().eq('tour_id', tourId);
    if (deleteError) throw deleteError;

    // 3. Insert new route points
    if (stops.length > 0) {
        const routePointsToInsert = stops.map((stop: { id: number }, index: number) => ({
            tour_id: tourId,
            stop_id: stop.id,
            position: index,
        }));
        const { error: insertError } = await supabase.from('tour_route_points').insert(routePointsToInsert);
        if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ success: true, tourId }), {
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