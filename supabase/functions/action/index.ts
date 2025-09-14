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
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("User not found")

    const getPermissions = async () => {
        const { data, error } = await supabase.rpc('get_my_permissions');
        if (error) throw error;
        return data.map((p: any) => p.permission_name);
    };

    switch (action) {
      case 'login': {
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

        const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

        if (userError || !authUser || !authUser.email) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
            email: authUser.email,
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

      case 'get-planned-tour-for-vehicle': {
        const { vehicleId } = payload;
        if (!vehicleId) {
          return new Response(JSON.stringify({ error: 'Vehicle ID is required' }), { status: 400 });
        }

        const { data: orders, error: orderError } = await supabaseAdmin
          .from('freight_orders')
          .select('*, freight_order_stops(*), cargo_items(*)')
          .eq('vehicle_id', vehicleId)
          .in('status', ['Angelegt', 'Geplant', 'Unterwegs'])
          .order('pickup_date', { ascending: true });

        if (orderError) throw orderError;
        
        for (const order of orders) {
            if (order.freight_order_stops) {
                order.freight_order_stops.sort((a: any, b: any) => a.position - b.position);
            }
        }

        return new Response(JSON.stringify({ tour: orders || [] }), {
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
          .select('*, freight_order_stops(*), cargo_items(*), vehicles(max_payload_kg)')
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
          .select('*, freight_order_stops(*), cargo_items(*)')
          .eq('status', 'Angelegt')
          .is('vehicle_id', null)
          .neq('id', currentOrderId);
        if (potentialOrdersError) throw potentialOrdersError;

        const maxPayload = currentOrder.vehicles?.max_payload_kg;
        const currentWeight = currentOrder.cargo_items.reduce((sum: number, item: any) => sum + (item.weight || 0), 0);

        const validFollowUps = [];
        for (const order of potentialOrders) {
          if (!order.freight_order_stops || order.freight_order_stops.length === 0) continue;
          order.freight_order_stops.sort((a: any, b: any) => a.position - b.position);
          const firstStop = order.freight_order_stops[0];
          const lastStopOfFollowUp = order.freight_order_stops[order.freight_order_stops.length - 1];
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

          let isOverweight = false;
          if (maxPayload) {
              const followUpWeight = order.cargo_items.reduce((sum: number, item: any) => sum + (item.weight || 0), 0);
              if (currentWeight + followUpWeight > maxPayload) {
                  isOverweight = true;
              }
          }

          if (arrivalAtPickupTimestamp <= pickupDeadlineTimestamp) {
            validFollowUps.push({
              ...order,
              origin_address: firstStop.address,
              destination_address: lastStopOfFollowUp.address,
              travel_duration_hours: (travelDurationSeconds / 3600).toFixed(2),
              is_overweight: isOverweight,
            });
          }
        }

        return new Response(JSON.stringify({ followUpOrders: validFollowUps }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      case 'assign-vehicle-to-orders': {
        const { vehicleId, orderIds } = payload;
        if (!vehicleId || !Array.isArray(orderIds)) {
          return new Response(JSON.stringify({ error: 'Vehicle ID and an array of Order IDs are required.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        // Get all orders currently assigned to this vehicle
        const { data: currentAssignments, error: fetchError } = await supabaseAdmin
          .from('freight_orders')
          .select('id')
          .eq('vehicle_id', vehicleId);
        if (fetchError) throw fetchError;
        const currentOrderIds = currentAssignments.map(o => o.id);

        // Determine which orders to unassign
        const idsToUnassign = currentOrderIds.filter(id => !orderIds.includes(id));
        if (idsToUnassign.length > 0) {
          const { error: unassignError } = await supabaseAdmin
            .from('freight_orders')
            .update({ vehicle_id: null, status: 'Angelegt' })
            .in('id', idsToUnassign);
          if (unassignError) throw unassignError;
        }

        // Assign/update the new set of orders
        if (orderIds.length > 0) {
            const { error } = await supabaseAdmin
            .from('freight_orders')
            .update({ 
                vehicle_id: vehicleId,
                status: 'Geplant'
            })
            .in('id', orderIds);
            if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Work Time Actions
      case 'get-work-time-status': {
        const permissionNames = await getPermissions();
        const targetUserId = payload?.userId || user.id;
        if (targetUserId !== user.id && !permissionNames.includes('work_time.manage')) {
            throw new Error("Permission denied");
        }
        const { data, error } = await supabase.from('work_sessions').select('*').eq('user_id', targetUserId).is('end_time', null).maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ status: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'clock-in': {
        const { data: existing, error: existingError } = await supabase.from('work_sessions').select('id').eq('user_id', user.id).is('end_time', null).single();
        if (existingError && existingError.code !== 'PGRST116') throw existingError;
        if (existing) throw new Error("Bereits eingestempelt.");
        
        const { data, error } = await supabase.from('work_sessions').insert({ user_id: user.id, start_time: new Date().toISOString() }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }
      case 'clock-out': {
        const { data, error } = await supabase.from('work_sessions').update({ end_time: new Date().toISOString() }).eq('user_id', user.id).is('end_time', null).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'get-work-time-history': {
        const permissionNames = await getPermissions();
        const targetUserId = payload?.userId || user.id;
        if (targetUserId !== user.id && !permissionNames.includes('work_time.manage')) {
            throw new Error("Permission denied");
        }
        const { startDate, endDate } = payload;
        let query = supabase.from('work_sessions').select('*').eq('user_id', targetUserId).order('start_time', { ascending: false });
        if (startDate) query = query.gte('start_time', startDate);
        if (endDate) query = query.lte('start_time', endDate);
        const { data, error } = await query;
        if (error) throw error;
        return new Response(JSON.stringify({ history: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'get-user-work-details': {
        const permissionNames = await getPermissions();
        const targetUserId = payload?.userId || user.id;
        if (targetUserId !== user.id && !permissionNames.includes('work_time.manage')) {
            throw new Error("Permission denied");
        }
        const { data, error } = await supabaseAdmin.from('work_hours_history').select('hours_per_week').eq('user_id', targetUserId).order('effective_date', { ascending: false }).limit(1).single();
        if (error && error.code !== 'PGRST116') throw error;
        return new Response(JSON.stringify({ details: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'create-work-time': {
        const permissionNames = await getPermissions();
        const targetUserId = payload?.userId || user.id;
        if (targetUserId !== user.id && !permissionNames.includes('work_time.manage')) {
            throw new Error("Permission denied");
        }
        const { start_time, end_time, break_duration_minutes, notes } = payload;
        if (!start_time) throw new Error("Start time is required.");
        
        const { data, error } = await supabase.from('work_sessions').insert({ 
            user_id: targetUserId, 
            start_time,
            end_time,
            break_duration_minutes,
            notes
        }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }
      case 'update-work-time': {
        const { id, userId, ...updateData } = payload;
        const { data, error } = await supabase.from('work_sessions').update(updateData).eq('id', id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'delete-work-time': {
        const { id } = payload;
        const { error } = await supabase.from('work_sessions').delete().eq('id', id);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      case 'delete-work-hour-history': {
        const permissionNames = await getPermissions();
        if (!permissionNames.includes('personnel_files.manage')) {
            throw new Error("Permission denied. You need 'personnel_files.manage' permission.");
        }
        const { id } = payload;
        if (!id) throw new Error("History entry ID is required.");
        const { error } = await supabaseAdmin.from('work_hours_history').delete().eq('id', id);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      case 'get-annual-work-time-summary': {
        const permissionNames = await getPermissions();
        if (!permissionNames.includes('work_time.manage')) {
            throw new Error("Permission denied");
        }
        const { userId, year } = payload;
        if (!userId || !year) throw new Error("User ID and year are required.");

        const startDate = new Date(year, 0, 1).toISOString();
        const endDate = new Date(year + 1, 0, 1).toISOString();

        const { data: sessions, error: sessionsError } = await supabaseAdmin
            .from('work_sessions')
            .select('start_time, end_time, break_duration_minutes')
            .eq('user_id', userId)
            .gte('start_time', startDate)
            .lt('start_time', endDate);
        if (sessionsError) throw sessionsError;

        const { data: history, error: historyError } = await supabaseAdmin
            .from('work_hours_history')
            .select('hours_per_week, effective_date')
            .eq('user_id', userId)
            .order('effective_date', { ascending: true });
        if (historyError) throw historyError;

        return new Response(JSON.stringify({ sessions, workHoursHistory: history }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Vacation Actions
      case 'create-vacation-request': {
        const permissionNames = await getPermissions();
        const isSuperAdmin = permissionNames.includes('roles.manage') && permissionNames.includes('users.manage');
        const canManage = isSuperAdmin || permissionNames.includes('vacations.manage');
        if (!canManage) throw new Error("Permission denied.");
        
        const { userId, date } = payload;
        const { data, error } = await supabaseAdmin.from('vacation_requests').insert({
          user_id: userId,
          start_date: date,
          end_date: date,
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ request: data }), { status: 201, headers: corsHeaders });
      }
      case 'delete-vacation-request': {
        const { requestId } = payload;
        const { error } = await supabase.from('vacation_requests').delete().eq('id', requestId);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      case 'update-vacation-request': {
        const { requestId, startDate, endDate, notes } = payload;
        if (!requestId || !startDate || !endDate) {
            throw new Error('Request ID, start date, and end date are required');
        }
        const { error } = await supabase.rpc('update_vacation_request', {
          p_request_id: requestId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_notes: notes || '',
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
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