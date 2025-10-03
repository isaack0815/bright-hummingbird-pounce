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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, username')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    const { data: workHours, error: workHoursError } = await supabase
      .from('work_hours_history')
      .select('hours_per_week')
      .eq('user_id', user.id)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();
    
    if (workHoursError && workHoursError.code !== 'PGRST116') { // Ignore "No rows found"
        throw workHoursError;
    }

    const userDetails = {
      email: user.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      username: profile.username,
      hours_per_week: workHours?.hours_per_week || null,
    };

    return new Response(JSON.stringify({ profile: userDetails }), {
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