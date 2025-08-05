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

    const { title, description, start_time, end_time, attendee_ids } = await req.json();
    if (!title || !start_time) {
      return new Response(JSON.stringify({ error: 'Title and start time are required' }), { status: 400 });
    }

    const { data, error } = await supabase.rpc('create_event_with_attendees', {
      p_title: title,
      p_description: description,
      p_start_time: start_time,
      p_end_time: end_time,
      p_attendee_ids: attendee_ids,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ eventId: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})