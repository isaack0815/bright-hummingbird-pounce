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

    const { assignmentId, status } = await req.json();
    if (!assignmentId || !status) {
      return new Response(JSON.stringify({ error: 'Assignment ID and status are required' }), { status: 400 });
    }

    let updateData = {};
    if (status === 'start') {
      updateData = { started_at: new Date().toISOString(), action_by: user.id };
    } else if (status === 'complete') {
      updateData = { completed_at: new Date().toISOString(), action_by: user.id };
    } else {
      return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 });
    }

    const { data, error } = await supabase
      .from('daily_tour_assignments')
      .update(updateData)
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ assignment: data }), {
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