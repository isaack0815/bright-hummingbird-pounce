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

    const { userId, firstName, lastName, username, roleIds, vacationDays, commuteKm, hoursPerWeek, birthDate } = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Update user metadata in auth.users
    await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: { first_name: firstName, last_name: lastName, username } }
    )
    
    // 2. Upsert profile data
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
      })

    // 3. Handle work hours history
    if (hoursPerWeek !== null && hoursPerWeek !== undefined) {
      const { data: latestHours, error: latestHoursError } = await supabaseAdmin
        .from('work_hours_history')
        .select('hours_per_week')
        .eq('user_id', userId)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();

      if (latestHoursError && latestHoursError.code !== 'PGRST116') { // Ignore "no rows found" error
        throw latestHoursError;
      }

      if (!latestHours || latestHours.hours_per_week !== hoursPerWeek) {
        await supabaseAdmin.from('work_hours_history').insert({
          user_id: userId,
          hours_per_week: hoursPerWeek,
          effective_date: new Date().toISOString().split('T')[0], // Today's date
        });
      }
    }

    // 4. Update user roles, ONLY if roleIds are provided in the request
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