import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERIZON_SERVICE_NAME = 'verizon_connect_fleetmatics';
const VERIZON_TOKEN_URL = 'https://fim.api.eu.fleetmatics.com:443/token/';
const VEHICLES_LOCATION_API_URL = 'https://fim.api.eu.fleetmatics.com:443/rad/v1/vehicles/locations';
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

    // 1. Get our local vehicles that have a Verizon ID
    const { data: localVehicles, error: localVehiclesError } = await supabaseAdmin
      .from('vehicles')
      .select('id, license_plate, verizon_vehicle_id')
      .not('verizon_vehicle_id', 'is', null);

    if (localVehiclesError) throw localVehiclesError;

    if (!localVehicles || localVehicles.length === 0) {
      return new Response(JSON.stringify({ vehicles: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const vehicleNumbers = localVehicles.map(v => v.verizon_vehicle_id);

    // 2. Get the access token
    const accessToken = await getAccessToken(supabaseAdmin);

    // 3. Fetch locations from Verizon API
    const response = await fetch(VEHICLES_LOCATION_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Atmosphere atmosphere_app_id=${ATMOSPHERE_APP_ID}, Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ VehicleNumbers: vehicleNumbers }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Fehler von der Verizon API: ${response.status} - ${errorBody}`);
    }

    const rawData = await response.json();
    const verizonDataMap = new Map(rawData.map((item: any) => [item.VehicleNumber, item]));

    // 4. Combine local data with Verizon data
    const combinedVehicles = localVehicles.map(localVehicle => {
      const verizonData = verizonDataMap.get(localVehicle.verizon_vehicle_id);
      const value = verizonData?.ContentResource?.Value;

      if (!value) {
        return {
          id: localVehicle.id,
          vehicleName: localVehicle.verizon_vehicle_id,
          licensePlate: localVehicle.license_plate,
          driverName: 'N/A',
          speed: { value: 0, unit: 'km/h' },
          location: { latitude: 0, longitude: 0, address: 'Keine Daten von Verizon empfangen' },
          lastContactTime: null,
        };
      }

      const addressParts = [
        value.Address?.AddressLine1,
        value.Address?.AddressLine2,
        `${value.Address?.PostalCode || ''} ${value.Address?.Locality || ''}`.trim(),
        value.Address?.Country
      ].filter(Boolean);

      return {
        id: localVehicle.id,
        vehicleName: verizonData.VehicleNumber,
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