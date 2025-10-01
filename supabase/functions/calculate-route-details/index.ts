import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { origin, destination } = await req.json();
    if (!origin || !destination) {
      return new Response(JSON.stringify({ error: 'Origin and destination are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not set in Supabase secrets.');
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}&units=metric`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Distance Matrix API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status !== 'OK' || !data.rows[0] || !data.rows[0].elements[0] || data.rows[0].elements[0].status !== 'OK') {
      console.warn("Google API could not calculate distance:", data.status, data.rows[0]?.elements[0]?.status);
      return new Response(JSON.stringify({ distance: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const distanceInMeters = data.rows[0].elements[0].distance.value;
    
    return new Response(JSON.stringify({ distance: distanceInMeters }), {
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