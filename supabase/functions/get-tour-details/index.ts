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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { tourId } = await req.json();
    if (!tourId) {
        return new Response(JSON.stringify({ error: 'Tour ID is required' }), { status: 400 });
    }

    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('*')
      .eq('id', tourId)
      .single();

    if (tourError) throw tourError;

    const { data: routePoints, error: pointsError } = await supabase
      .from('tour_route_points')
      .select('*, tour_stops(*)')
      .eq('tour_id', tourId)
      .order('position');

    if (pointsError) throw pointsError;

    const tourDetails = { 
      ...tour, 
      stops: routePoints.map(rp => ({ 
        ...rp.tour_stops, 
        position: rp.position, 
        route_point_id: rp.id,
        weekdays: rp.weekdays,
        arrival_time: rp.arrival_time,
        remarks: rp.remarks
      })) 
    };

    return new Response(JSON.stringify({ tour: tourDetails }), {
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