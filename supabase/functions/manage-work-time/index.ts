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
    if (!user) throw new Error("User not found")

    const { action, payload } = await req.json();

    switch (action) {
      case 'get-status': {
        const { data, error } = await supabase
          .from('work_sessions')
          .select('*')
          .eq('user_id', user.id)
          .is('end_time', null)
          .maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ status: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'clock-in': {
        const { data: existing, error: existingError } = await supabase.from('work_sessions').select('id').eq('user_id', user.id).is('end_time', null).single();
        if (existingError && existingError.code !== 'PGRST116') throw existingError;
        if (existing) throw new Error("Bereits eingestempelt.");
        
        const { data, error } = await supabase.from('work_sessions').insert({ user_id: user.id, start_time: new Date().toISOString() }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }
      case 'clock-out': {
        const { data, error } = await supabase.from('work_sessions').update({ end_time: new Date().toISOString() }).eq('user_id', user.id).is('end_time', null).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'get-history': {
        const { startDate, endDate } = payload;
        let query = supabase.from('work_sessions').select('*').eq('user_id', user.id).order('start_time', { ascending: false });
        if (startDate) query = query.gte('start_time', startDate);
        if (endDate) query = query.lte('start_time', endDate);
        const { data, error } = await query;
        if (error) throw error;
        return new Response(JSON.stringify({ history: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'update': {
        const { id, ...updateData } = payload;
        const { data, error } = await supabase.from('work_sessions').update(updateData).eq('id', id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'delete': {
        const { id } = payload;
        const { error } = await supabase.from('work_sessions').delete().eq('id', id);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})