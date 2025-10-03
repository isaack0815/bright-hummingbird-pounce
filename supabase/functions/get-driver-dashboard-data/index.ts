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
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("User not authenticated");

    const today = new Date().toISOString().split('T')[0];

    // 1. Get today's tour assignments for the user
    const { data: assignments, error: assignmentsError } = await supabase
      .from('daily_tour_assignments')
      .select(`
        id,
        position,
        started_at,
        completed_at,
        tours (id, name),
        tour_stops (id, name, address)
      `)
      .eq('dispatch_date', today)
      .order('position', { ascending: true });

    if (assignmentsError) throw assignmentsError;
    
    // Filter assignments to find the ones where the user is a driver for that tour on that day
    const { data: rosterEntries, error: rosterError } = await supabase
      .from('duty_roster_entries')
      .select('tour_id')
      .eq('user_id', user.id)
      .eq('duty_date', today);

    if (rosterError) throw rosterError;

    const userTourIds = rosterEntries.map(e => e.tour_id);
    const userAssignments = assignments.filter(a => userTourIds.includes(a.tours.id));

    // 2. Get current work time status
    const { data: workSession, error: workSessionError } = await supabase
      .from('work_sessions')
      .select('id, start_time')
      .eq('user_id', user.id)
      .is('end_time', null)
      .single();

    if (workSessionError && workSessionError.code !== 'PGRST116') { // Ignore "No rows found"
      throw workSessionError;
    }

    // 3. Get manager ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('manager_id')
      .eq('id', user.id)
      .single();
    
    if (profileError) throw profileError;

    // Group assignments by tour
    const tours = userAssignments.reduce((acc, assignment) => {
      const tourId = assignment.tours.id;
      if (!acc[tourId]) {
        acc[tourId] = {
          id: tourId,
          name: assignment.tours.name,
          stops: [],
        };
      }
      acc[tourId].stops.push({
        assignment_id: assignment.id,
        position: assignment.position,
        started_at: assignment.started_at,
        completed_at: assignment.completed_at,
        ...assignment.tour_stops,
      });
      return acc;
    }, {});

    return new Response(JSON.stringify({
      tours: Object.values(tours),
      workSession: workSession || null,
      managerId: profile?.manager_id || null,
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