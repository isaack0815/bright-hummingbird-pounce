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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId } = await req.json();
    if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError) throw authError;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(); // Use maybeSingle() to handle cases where a profile might not exist
    if (profileError) throw profileError;

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('roles(id, name)')
      .eq('user_id', userId);
    if (rolesError) throw rolesError;

    const { data: workHoursHistory, error: workHoursError } = await supabaseAdmin
      .from('work_hours_history')
      .select('*')
      .eq('user_id', userId)
      .order('effective_date', { ascending: false });
    if (workHoursError) throw workHoursError;

    const userDetails = {
      ...user,
      ...profile,
      roles: roles?.map(r => r.roles) || [],
      work_hours_history: workHoursHistory || [],
    };

    return new Response(JSON.stringify({ user: userDetails }), {
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