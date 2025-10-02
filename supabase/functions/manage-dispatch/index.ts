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
    
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { action, payload } = await req.json();

    switch (action) {
      case 'get-assignments-for-date': {
        const { date } = payload;
        if (!date) {
          return new Response(JSON.stringify({ error: 'Date is required' }), { status: 400 });
        }
        const { data, error } = await supabase
          .from('daily_tour_assignments')
          .select('tour_id, stop_id, position')
          .eq('dispatch_date', date)
          .order('position');
        if (error) throw error;
        return new Response(JSON.stringify({ assignments: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'save-assignments-for-date': {
        const { date, assignments } = payload; // assignments is Record<number, number[]> tourId -> stopIds
        if (!date || !assignments) {
          return new Response(JSON.stringify({ error: 'Date and assignments are required' }), { status: 400 });
        }

        // Delete existing assignments for this date
        const { error: deleteError } = await supabase
          .from('daily_tour_assignments')
          .delete()
          .eq('dispatch_date', date);
        if (deleteError) throw deleteError;

        // Insert new assignments
        const assignmentsToInsert = [];
        for (const tourIdStr in assignments) {
          const tourId = Number(tourIdStr);
          const stopIds = assignments[tourIdStr];
          for (let i = 0; i < stopIds.length; i++) {
            assignmentsToInsert.push({
              tour_id: tourId,
              stop_id: stopIds[i],
              dispatch_date: date,
              position: i,
              assigned_by: user.id,
            });
          }
        }

        if (assignmentsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('daily_tour_assignments')
            .insert(assignmentsToInsert);
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