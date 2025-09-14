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
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;
    
    const permissionNames = permissions.map((p: { permission_name: string }) => p.permission_name);
    const isSuperAdmin = permissionNames.includes('roles.manage') && permissionNames.includes('users.manage');
    const canManage = isSuperAdmin || permissionNames.includes('vacations.manage');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, payload } = await req.json();

    switch (action) {
      case 'create': {
        if (!canManage) throw new Error("Permission denied.");
        const { userId, date } = payload;
        const { data, error } = await supabaseAdmin.from('vacation_requests').insert({
          user_id: userId,
          start_date: date,
          end_date: date,
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ request: data }), { status: 201, headers: corsHeaders });
      }
      
      case 'update': {
        const { requestId, startDate, endDate, notes } = payload;
        const { data, error } = await supabaseAdmin.rpc('update_vacation_request', {
          p_request_id: requestId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_notes: notes,
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      case 'delete': {
        const { requestId } = payload;
        const { error } = await supabaseAdmin.from('vacation_requests').delete().eq('id', requestId);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})