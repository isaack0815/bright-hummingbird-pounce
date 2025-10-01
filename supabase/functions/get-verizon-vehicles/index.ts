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

    const { data: localVehicles, error: localVehiclesError } = await supabaseAdmin
      .from('vehicles')
      .select('id, license_plate, verizon_vehicle_id, type')
      .not('verizon_vehicle_id', 'is', null);

    if (localVehiclesError) throw localVehiclesError;

    if (!localVehicles || localVehicles.length === 0) {
      return new Response(JSON.stringify({ vehicles: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const vehicleDataPromises = localVehicles.map(async (localVehicle) => {
      if (!localVehicle.verizon_vehicle_id) return null;

      const url = `${VEHICLES_API_URL}/${localVehicle.verizon_vehicle_id}/location`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Atmosphere atmosphere_app_id=${ATMOSPHERE_APP_ID}, Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch Verizon data for ${localVehicle.verizon_vehicle_id}: ${response.status}`);
        return {
          id: localVehicle.id,
          vehicleName: localVehicle.verizon_vehicle_id,
          vehicleType: localVehicle.type,
          licensePlate: localVehicle.license_plate,
          driverName: 'N/A',
          speed: { value: 0, unit: 'km/h' },
          location: { latitude: 0, longitude: 0, address: `Fehler beim Abruf: ${response.status}` },
          lastContactTime: null,
        };
      }

      const value = await response.json();

      const addressParts = [
        value.Address?.AddressLine1,
        value.Address?.AddressLine2,
        `${value.Address?.PostalCode || ''} ${value.Address?.Locality || ''}`.trim(),
        value.Address?.Country
      ].filter(Boolean);

      return {
        id: localVehicle.id,
        vehicleName: localVehicle.verizon_vehicle_id,
        vehicleType: localVehicle.type,
        licensePlate: localVehicle.license_plate,
        driverName: value.DriverNumber || null,
        speed: {
          value: value.Speed,
          unit: 'km/h'
        },
        location: {
          latitude: value.Latitude,
          longitude: value.Longitude,
          address: addressParts.join(', ') || 'Adresse nicht verfügbar'
        },
        lastContactTime: value.UpdateUTC,
      };
    });

    const combinedVehicles = (await Promise.all(vehicleDataPromises)).filter(Boolean);

    return new Response(JSON.stringify({ vehicles: combinedVehicles }), {
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