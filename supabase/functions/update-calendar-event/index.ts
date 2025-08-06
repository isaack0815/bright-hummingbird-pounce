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

    const { id, title, description, start_time, end_time, attendee_ids } = await req.json();
    if (!id || !title || !start_time) {
      return new Response(JSON.stringify({ error: 'Event ID, title and start time are required' }), { status: 400 });
    }

    // Update the event details
    const { error: updateError } = await supabase
      .from('calendar_events')
      .update({ title, description, start_time, end_time })
      .eq('id', id)
      .eq('created_by', user.id); // RLS also protects this, but it's good practice
    if (updateError) throw updateError;

    // Delete existing attendees
    const { error: deleteError } = await supabase
      .from('calendar_event_attendees')
      .delete()
      .eq('event_id', id);
    if (deleteError) throw deleteError;

    // Add new attendees, ensuring creator is always included
    const allAttendees = [...new Set([...(attendee_ids || []), user.id])];
    const attendeesToInsert = allAttendees.map(userId => ({
      event_id: id,
      user_id: userId,
    }));

    const { error: insertError } = await supabase
      .from('calendar_event_attendees')
      .insert(attendeesToInsert);
    if (insertError) throw insertError;

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