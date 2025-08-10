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

    const { rosterId, date, assignments } = await req.json();
    if (!rosterId || !date || !assignments) {
        return new Response(JSON.stringify({ error: 'Roster ID, date, and assignments are required' }), { status: 400 });
    }

    // Delete existing entries for this roster and date
    const { error: deleteError } = await supabase
      .from('duty_roster_entries')
      .delete()
      .eq('roster_id', rosterId)
      .eq('duty_date', date);
    if (deleteError) throw deleteError;

    // Insert new entries if any
    if (assignments.length > 0) {
        const entriesToInsert = assignments.map((entry: any) => ({
            roster_id: rosterId,
            user_id: entry.user_id,
            tour_id: entry.tour_id,
            duty_date: date,
        }));
        const { error: insertError } = await supabase.from('duty_roster_entries').insert(entriesToInsert);
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