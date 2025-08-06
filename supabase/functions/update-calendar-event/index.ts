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
    // 1. Create a client with user's auth token to get user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    const { id, title, description, start_time, end_time, attendee_ids } = await req.json();
    if (!id || !title || !start_time) {
      return new Response(JSON.stringify({ error: 'Event ID, title and start time are required' }), { status: 400 });
    }

    // 2. Create an admin client to perform operations, bypassing RLS after manual checks
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Manually verify that the user is the creator of the event before proceeding
    const { data: event, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (event.created_by !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: You are not the creator of this event.' }), { status: 403 });
    }

    // 4. Update the event details using the admin client
    const { error: updateError } = await supabaseAdmin
      .from('calendar_events')
      .update({ title, description, start_time, end_time })
      .eq('id', id);
    if (updateError) throw updateError;

    // 5. Delete existing attendees using the admin client
    const { error: deleteError } = await supabaseAdmin
      .from('calendar_event_attendees')
      .delete()
      .eq('event_id', id);
    if (deleteError) throw deleteError;

    // 6. Add new attendees, ensuring creator is always included
    const allAttendees = [...new Set([...(attendee_ids || []), user.id])];
    if (allAttendees.length > 0) {
      const attendeesToInsert = allAttendees.map(userId => ({
        event_id: id,
        user_id: userId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('calendar_event_attendees')
        .insert(attendeesToInsert);
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ success: true }), {
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