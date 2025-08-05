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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    const { month, year } = await req.json();
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 1).toISOString();

    // Fetch events the user is part of, along with attendee user IDs
    const { data: events, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*, calendar_event_attendees(user_id)')
      .gte('start_time', startDate)
      .lt('start_time', endDate);
    if (eventsError) throw eventsError;

    // Collect all unique user IDs from events and attendees
    const userIds = new Set<string>();
    if (events) {
      events.forEach(event => {
        userIds.add(event.created_by);
        (event.calendar_event_attendees as any[]).forEach(attendee => {
          userIds.add(attendee.user_id);
        });
      });
    }

    let combinedEvents: any[] = [];
    if (userIds.size > 0 && events) {
      // Fetch all required profiles in one go
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', Array.from(userIds));
      if (profilesError) throw profilesError;

      const profilesMap = new Map(profiles.map(p => [p.id, p]));

      // Manually join the profiles to the events data
      combinedEvents = events.map(event => {
        const attendees = (event.calendar_event_attendees as any[]).map(attendee => ({
          profiles: profilesMap.get(attendee.user_id) || null
        }));
        
        const { calendar_event_attendees, ...restOfEvent } = event;

        return {
          ...restOfEvent,
          profiles: profilesMap.get(event.created_by) || null,
          attendees: attendees,
        };
      });
    }

    // Fetch all profiles for birthdays
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('first_name, last_name, birth_date')
      .not('birth_date', 'is', null);
    if (profilesError) throw profilesError;

    const birthdays = allProfiles
      .filter(p => p.birth_date && new Date(p.birth_date).getMonth() === month)
      .map(p => ({
        name: `${p.first_name} ${p.last_name}`,
        day: new Date(p.birth_date!).getDate(),
      }));

    return new Response(JSON.stringify({ events: combinedEvents, birthdays }), {
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