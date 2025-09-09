import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERIZON_SERVICE_NAME = 'verizon_connect_fleetmatics';
const VERIZON_TOKEN_URL = 'https://fim.api.eu.fleetmatics.com:443/token/';
const VEHICLES_API_URL = 'https://fim.api.eu.fleetmatics.com:443/rad/v1/vehicles';
const ATMOSPHERE_APP_ID = 'fleetmatics-p-eu-BcgrmZVK3NtIxyuoqVZMUQ8O0zp8kB20En9goyaK';

async function getAccessToken(supabaseAdmin: any): Promise<string> {
  const { data: tokenData } = await supabaseAdmin
    .from('api_tokens')
    .select('access_token, expires_at')
    .eq('service_name', VERIZON_SERVICE_NAME)
    .single();

  if (tokenData && new Date(tokenData.expires_at) > new Date(Date.now() + 60000)) {
    return tokenData.access_token;
  }

  const username = Deno.env.get('VERIZON_USERNAME');
  const password = Deno.env.get('VERIZON_PASSWORD');

  if (!username || !password) {
    throw new Error('VERIZON_USERNAME and VERIZON_PASSWORD must be set in Supabase secrets.');
  }

  const tokenResponse = await fetch(VERIZON_TOKEN_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
      'Accept': 'application/json',
    },
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Failed to get Verizon token: ${tokenResponse.status} - ${errorBody}`);
  }

  const accessToken = await tokenResponse.text();
  
  // Verizon token does not have an expiry, so we set it for 24 hours for safety
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  await supabaseAdmin
    .from('api_tokens')
    .upsert({
      service_name: VERIZON_SERVICE_NAME,
      access_token: accessToken,
      expires_at: expires_at,
    });

  return accessToken;
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

    const accessToken = await getAccessToken(supabaseAdmin);

    const response = await fetch(VEHICLES_API_URL, {
      headers: {
        'Authorization': `Atmosphere atmosphere_app_id=${ATMOSPHERE_APP_ID}, Bearer ${accessToken}`,
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