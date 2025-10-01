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

    const { action, ...payload } = await req.json();

    switch (action) {
      case 'create': {
        const { work_group_id, start_date, end_date } = payload;
        if (!work_group_id || !start_date || !end_date) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
        }
        // Use upsert to prevent race conditions where the user might click "create" twice.
        const { data, error } = await supabase
          .from('duty_rosters')
          .upsert({ work_group_id, start_date, end_date }, { onConflict: 'work_group_id,start_date' })
          .select('id')
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ roster: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }

      case 'delete': {
        const { rosterId } = payload;
        if (!rosterId) {
            return new Response(JSON.stringify({ error: 'Roster ID is required' }), { status: 400 });
        }
        const { error } = await supabase.from('duty_rosters').delete().eq('id', rosterId);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      case 'update-entries': {
        const { rosterId, entries } = payload;
        if (!rosterId || !entries) {
            return new Response(JSON.stringify({ error: 'Roster ID and entries are required' }), { status: 400 });
        }
        await supabase.from('duty_roster_entries').delete().eq('roster_id', rosterId);
        if (entries.length > 0) {
            const entriesToInsert = entries.map((entry: any) => ({
                roster_id: rosterId,
                user_id: entry.user_id,
                tour_id: entry.tour_id,
                duty_date: entry.duty_date,
            }));
            await supabase.from('duty_roster_entries').insert(entriesToInsert);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'update-entries-for-day': {
        const { rosterId, date, assignments } = payload;
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
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})