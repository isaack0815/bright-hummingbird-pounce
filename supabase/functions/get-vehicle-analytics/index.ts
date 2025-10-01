import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const getGoogleApiKey = () => {
    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not set in Supabase secrets.');
    }
    return apiKey;
}

const calculateRouteDistance = async (origin: string, destination: string): Promise<number | null> => {
    if (!origin || !destination) return null;
    try {
        const apiKey = getGoogleApiKey();
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}&units=metric`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google Distance Matrix API error: ${response.statusText}`);
        const data = await response.json();
        if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
            return data.rows[0].elements[0].distance.value; // distance in meters
        }
        return null;
    } catch (e) {
        console.error("Error calculating route distance:", e.message);
        return null;
    }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { vehicleId, startDate, endDate } = await req.json();
    if (!vehicleId || !startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'vehicleId, startDate, and endDate are required' }), { status: 400 });
    }

    const { data: settings, error: settingsError } = await supabaseAdmin.from('settings').select('*');
    if (settingsError) throw settingsError;
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('freight_orders')
      .select('id, order_number, price, origin_address, destination_address, delivery_date, cargo_items(weight, loading_meters)')
      .eq('vehicle_id', vehicleId)
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate);
    if (ordersError) throw ordersError;

    const processedOrders = await Promise.all(orders.map(async (order) => {
      const distanceInMeters = await calculateRouteDistance(order.origin_address, order.destination_address);
      let calculated_cost = 0;
      if (distanceInMeters) {
        const distanceInKm = distanceInMeters / 1000;
        const totalWeight = order.cargo_items.reduce((sum: number, item: any) => sum + (item.weight || 0), 0);
        const totalLoadingMeters = order.cargo_items.reduce((sum: number, item: any) => sum + (item.loading_meters || 0), 0);

        const weightLimit = Number(settingsMap.get('weight_limit_small_kg')) || 1000;
        const loadingMetersLimit = Number(settingsMap.get('loading_meters_limit_small')) || 4.5;
        const isLargeTransport = totalWeight > weightLimit || totalLoadingMeters > loadingMetersLimit;
        
        const pricePerKm = isLargeTransport 
            ? (Number(settingsMap.get('price_per_km_large')) || 1.8)
            : (Number(settingsMap.get('price_per_km_small')) || 0.9);
            
        calculated_cost = distanceInKm * pricePerKm;
      }
      
      return {
        ...order,
        calculated_cost,
      };
    }));

    const total_revenue = processedOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    const total_calculated_cost = processedOrders.reduce((sum, o) => sum + o.calculated_cost, 0);
    const total_orders = processedOrders.length;

    return new Response(JSON.stringify({ 
        orders: processedOrders,
        summary: {
            total_revenue,
            total_calculated_cost,
            total_orders,
            profit: total_revenue - total_calculated_cost,
        }
    }), {
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