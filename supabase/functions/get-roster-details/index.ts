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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { rosterId } = await req.json();
    if (!rosterId) {
        return new Response(JSON.stringify({ error: 'Roster ID is required' }), { status: 400 });
    }

    const { data: roster, error: rosterError } = await supabase
      .from('duty_rosters')
      .select('*, work_groups(*, user_work_groups(profiles(id, first_name, last_name)))')
      .eq('id', rosterId)
      .single();

    if (rosterError) throw rosterError;

    const { data: entries, error: entriesError } = await supabase
      .from('duty_roster_entries')
      .select('*, tours(id, name)')
      .eq('roster_id', rosterId);

    if (entriesError) throw entriesError;

    const rosterDetails = { 
      ...roster, 
      entries
    };

    return new Response(JSON.stringify({ roster: rosterDetails }), {
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