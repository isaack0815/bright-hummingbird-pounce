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
      .select('id, first_name, last_name, username, vacation_days_per_year, commute_km, entry_date, exit_date, works_weekends, manager_id')
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

    const { data: userWorkGroups, error: userWorkGroupsError } = await supabaseAdmin
      .from('user_work_groups')
      .select('user_id, work_groups(id, name)')
      .in('user_id', userIds);
    if (userWorkGroupsError) throw userWorkGroupsError;

    const userWorkGroupsMap = new Map<string, {id: number, name: string}[]>();
    if (userWorkGroups) {
      for (const uwg of userWorkGroups) {
        if (!userWorkGroupsMap.has(uwg.user_id)) {
            userWorkGroupsMap.set(uwg.user_id, []);
        }
        if (uwg.work_groups) {
          userWorkGroupsMap.get(uwg.user_id)!.push(uwg.work_groups as {id: number, name: string});
        }
      }
    }

    const { data: workHours, error: workHoursError } = await supabaseAdmin
      .from('work_hours_history')
      .select('user_id, hours_per_week')
      .in('user_id', userIds)
      .order('effective_date', { ascending: false });
    if (workHoursError) throw workHoursError;

    const latestWorkHoursMap = new Map<string, number>();
    if (workHours) {
        for (const wh of workHours) {
            if (!latestWorkHoursMap.has(wh.user_id)) {
                latestWorkHoursMap.set(wh.user_id, wh.hours_per_week);
            }
        }
    }

    const combinedUsers = users.map(user => {
      const profile = profilesMap.get(user.id);
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        first_name: profile?.first_name,
        last_name: profile?.last_name,
        username: profile?.username,
        roles: userRolesMap.get(user.id) || [],
        work_groups: userWorkGroupsMap.get(user.id) || [],
        vacation_days_per_year: profile?.vacation_days_per_year,
        commute_km: profile?.commute_km,
        hours_per_week: latestWorkHoursMap.get(user.id) || null,
        entry_date: profile?.entry_date,
        exit_date: profile?.exit_date,
        works_weekends: profile?.works_weekends,
        manager_id: profile?.manager_id,
      };
    });

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