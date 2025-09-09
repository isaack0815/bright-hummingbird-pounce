import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Helper Functions ---

const geocode = async (address: string): Promise<{lat: number, lng: number} | null> => {
    if (!address) return null;
    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_API_KEY is not set.');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].geometry.location;
    }
    return null;
};

const getRouteDuration = async (from: {lat: number, lng: number}, to: {lat: number, lng: number}): Promise<number | null> => {
    const url = `http://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            return data.routes[0].duration; // Duration in seconds
        }
        return null;
    } catch (e) {
        console.error("OSRM routing error:", e);
        return null;
    }
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, payload } = await req.json();
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    switch (action) {
      case 'login': {
        // ... (existing login logic)
        const { username, password } = payload;
        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Benutzername und Passwort sind erforderlich' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

        if (userError || !user || !user.email) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        );

        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: password,
        });

        if (signInError) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ session: sessionData.session }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'get-active-order-for-vehicle': {
        const { vehicleId } = payload;
        if (!vehicleId) {
          return new Response(JSON.stringify({ error: 'Vehicle ID is required' }), { status: 400 });
        }

        const { data: order, error: orderError } = await supabaseAdmin
          .from('freight_orders')
          .select('*, freight_order_stops(*)')
          .eq('vehicle_id', vehicleId)
          .in('status', ['Angelegt', 'Geplant', 'Unterwegs'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (orderError && orderError.code !== 'PGRST116') {
          throw orderError;
        }
        
        if (order && order.freight_order_stops) {
            order.freight_order_stops.sort((a: any, b: any) => a.position - b.position);
        }

        return new Response(JSON.stringify({ order: order || null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'get-follow-up-freight': {
        const { currentOrderId } = payload;
        if (!currentOrderId) {
          return new Response(JSON.stringify({ error: 'Current Order ID is required' }), { status: 400 });
        }

        const { data: currentOrder, error: currentOrderError } = await supabaseAdmin
          .from('freight_orders')
          .select('*, freight_order_stops(*)')
          .eq('id', currentOrderId)
          .single();
        if (currentOrderError) throw currentOrderError;
        
        currentOrder.freight_order_stops.sort((a: any, b: any) => a.position - b.position);
        const lastStop = currentOrder.freight_order_stops[currentOrder.freight_order_stops.length - 1];
        if (!lastStop) throw new Error("Current order has no stops.");

        const destinationCoords = await geocode(lastStop.address!);
        if (!destinationCoords) throw new Error(`Could not geocode destination: ${lastStop.address}`);

        const { data: potentialOrders, error: potentialOrdersError } = await supabaseAdmin
          .from('freight_orders')
          .select('*, freight_order_stops(*)')
          .eq('status', 'Angelegt')
          .is('vehicle_id', null)
          .neq('id', currentOrderId);
        if (potentialOrdersError) throw potentialOrdersError;

        const validFollowUps = [];
        for (const order of potentialOrders) {
          if (!order.freight_order_stops || order.freight_order_stops.length === 0) continue;
          order.freight_order_stops.sort((a: any, b: any) => a.position - b.position);
          const firstStop = order.freight_order_stops[0];
          if (!firstStop.address || !firstStop.stop_date) continue;
          
          const pickupCoords = await geocode(firstStop.address);
          if (!pickupCoords) continue;

          const travelDurationSeconds = await getRouteDuration(destinationCoords, pickupCoords);
          if (travelDurationSeconds === null) continue;

          const deliveryTimeStr = `${lastStop.stop_date}T${lastStop.time_end || '23:59:59'}`;
          const deliveryTimestamp = new Date(deliveryTimeStr).getTime();
          const arrivalAtPickupTimestamp = deliveryTimestamp + (travelDurationSeconds * 1000);

          const pickupTimeStr = `${firstStop.stop_date}T${firstStop.time_start || '00:00:00'}`;
          const pickupDeadlineTimestamp = new Date(pickupTimeStr).getTime();

          if (arrivalAtPickupTimestamp <= pickupDeadlineTimestamp) {
            validFollowUps.push({
              ...order,
              travel_duration_hours: (travelDurationSeconds / 3600).toFixed(2),
            });
          }
        }

        return new Response(JSON.stringify({ followUpOrders: validFollowUps }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Ungültige Aktion' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})