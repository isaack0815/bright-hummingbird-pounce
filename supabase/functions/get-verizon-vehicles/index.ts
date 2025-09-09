import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERIZON_SERVICE_NAME = 'verizon_connect';
const VERIZON_TOKEN_URL = 'https://login.reveal.verizonconnect.com/identity/connect/token';
const VERIZON_API_URL = 'https://api.reveal.verizonconnect.com/v1/vehicles';
const CLIENT_ID = 'ec-api-partner';
const CLIENT_SECRET = 'ec-api-partner-secret';

// Helper function to get a valid access token
async function getAccessToken(supabaseAdmin: any): Promise<string> {
  // 1. Try to get a valid token from the database
  const { data: tokenData, error: tokenError } = await supabaseAdmin
    .from('api_tokens')
    .select('access_token, expires_at')
    .eq('service_name', VERIZON_SERVICE_NAME)
    .single();

  if (tokenError && tokenError.code !== 'PGRST116') { // Ignore "no rows found"
    throw tokenError;
  }

  // Check if token exists and is not expired (with a 60-second buffer)
  if (tokenData && new Date(tokenData.expires_at) > new Date(Date.now() + 60000)) {
    return tokenData.access_token;
  }

  // 2. If no valid token, fetch a new one
  const username = Deno.env.get('VERIZON_USERNAME');
  const password = Deno.env.get('VERIZON_PASSWORD');

  if (!username || !password) {
    throw new Error('VERIZON_USERNAME and VERIZON_PASSWORD must be set in Supabase secrets.');
  }

  const tokenResponse = await fetch(VERIZON_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: username,
      password: password,
      scope: 'api',
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Failed to get Verizon token: ${tokenResponse.status} - ${errorBody}`);
  }

  const tokenJson = await tokenResponse.json();
  const { access_token, expires_in } = tokenJson;

  // 3. Save the new token to the database
  const expires_at = new Date(Date.now() + (expires_in * 1000)).toISOString();
  
  const { error: upsertError } = await supabaseAdmin
    .from('api_tokens')
    .upsert({
      service_name: VERIZON_SERVICE_NAME,
      access_token: access_token,
      expires_at: expires_at,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    console.error("Failed to save new Verizon token:", upsertError);
    // Continue with the new token even if saving failed, but log the error.
  }

  return access_token;
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

    const response = await fetch(VERIZON_API_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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