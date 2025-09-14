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

    const { action, payload } = await req.json();

    const { data: permissions } = await supabase.rpc('get_my_permissions');
    const canManage = permissions.some((p: any) => p.permission_name === 'vacations.manage');

    switch (action) {
      case 'get': {
        let query = supabase.from('vacation_requests').select('*, profiles!user_id(first_name, last_name)');
        if (!canManage) {
          query = query.eq('user_id', user.id);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ requests: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'create': {
        const { start_date, end_date, notes } = payload;
        const { data, error } = await supabase.from('vacation_requests').insert({ user_id: user.id, start_date, end_date, notes }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ request: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }
      case 'update-status': {
        if (!canManage) throw new Error("Permission denied.");
        const { id, status } = payload;
        const { data, error } = await supabase.from('vacation_requests').update({ status, approved_by: user.id, approved_at: new Date().toISOString() }).eq('id', id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ request: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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