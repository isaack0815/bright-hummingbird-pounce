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
    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;

    const permissionNames = permissions.map((p: { permission_name: string }) => p.permission_name);
    const canManageUsers = permissionNames.includes('users.manage');
    const canManagePersonnel = permissionNames.includes('personnel_files.manage');

    if (!canManageUsers && !canManagePersonnel) {
        return new Response(JSON.stringify({ error: 'Forbidden: You do not have permission to update user data.' }), { status: 403 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { userId, firstName, lastName, username, roleIds, vacationDays, commuteKm, hoursPerWeek, birthDate, workGroupIds, entryDate, exitDate, works_weekends } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: { first_name: firstName, last_name: lastName, username } }
    )
    
    await supabaseAdmin
      .from('profiles')
      .upsert({ 
        id: userId,
        first_name: firstName, 
        last_name: lastName, 
        username,
        vacation_days_per_year: vacationDays,
        commute_km: commuteKm,
        birth_date: birthDate || null,
        entry_date: entryDate || null,
        exit_date: exitDate || null,
        works_weekends: works_weekends,
      })

    if (hoursPerWeek !== null && hoursPerWeek !== undefined) {
      const { data: latestHours, error: latestHoursError } = await supabaseAdmin
        .from('work_hours_history')
        .select('hours_per_week')
        .eq('user_id', userId)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();

      if (latestHoursError && latestHoursError.code !== 'PGRST116') {
        throw latestHoursError;
      }

      if (!latestHours || Number(latestHours.hours_per_week) !== hoursPerWeek) {
        await supabaseAdmin.from('work_hours_history').insert({
          user_id: userId,
          hours_per_week: hoursPerWeek,
          effective_date: new Date().toISOString().split('T')[0],
        });
      }
    }

    if (roleIds !== undefined) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
      if (roleIds && roleIds.length > 0) {
        const rolesToInsert = roleIds.map((roleId: number) => ({
          user_id: userId,
          role_id: roleId,
        }));
        await supabaseAdmin.from('user_roles').insert(rolesToInsert)
      }
    }

    if (workGroupIds !== undefined) {
      await supabaseAdmin.from('user_work_groups').delete().eq('user_id', userId)
      if (workGroupIds && workGroupIds.length > 0) {
        const groupsToInsert = workGroupIds.map((groupId: number) => ({
          user_id: userId,
          work_group_id: groupId,
        }));
        await supabaseAdmin.from('user_work_groups').insert(groupsToInsert)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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