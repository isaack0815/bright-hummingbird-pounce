import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (_req) => {
  if (_req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const userIds = users.map(user => user.id);
    
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds);
    if (profilesError) throw profilesError;
    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    const { data: userRoles, error: userRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, roles(id, name)')
      .in('user_id', userIds);
    if (userRolesError) throw userRolesError;

    const userRolesMap = new Map<string, {id: number, name: string}[]>();
    if (userRoles) {
      for (const ur of userRoles) {
        if (!userRolesMap.has(ur.user_id)) {
            userRolesMap.set(ur.user_id, []);
        }
        if (ur.roles) {
          userRolesMap.get(ur.user_id)!.push(ur.roles as {id: number, name: string});
        }
      }
    }

    const combinedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      first_name: profilesMap.get(user.id)?.first_name,
      last_name: profilesMap.get(user.id)?.last_name,
      roles: userRolesMap.get(user.id) || [],
    }));

    return new Response(JSON.stringify({ users: combinedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('Error fetching users:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})