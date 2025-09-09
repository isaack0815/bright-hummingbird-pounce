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
    const apiKey = Deno.env.get('VERIZON_CONNECT_API_KEY');
    if (!apiKey) {
      throw new Error('VERIZON_CONNECT_API_KEY ist nicht in den Supabase Secrets konfiguriert.');
    }

    const verizonApiUrl = 'https://api.reveal.verizonconnect.com/v1/vehicles';

    const response = await fetch(verizonApiUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Fehler von der Verizon API: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({ vehicles: data }), {
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