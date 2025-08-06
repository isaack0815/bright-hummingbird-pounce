import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("--- [update-user] Function invoked ---");
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log("[update-user] Step 1: Received request body:", body);
    const { userId, firstName, lastName, username, roleIds, vacationDays, commuteKm, hoursPerWeek, birthDate } = body;

    if (!userId) {
      console.error("[update-user] Error: User ID is missing.");
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    console.log(`[update-user] Step 2: Processing update for user ID: ${userId}`);

    // 1. Update user metadata in auth.users
    console.log("[update-user] Step 3: Updating auth.users metadata...");
    await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: { first_name: firstName, last_name: lastName, username } }
    )
    console.log("[update-user] Step 3.1: auth.users metadata updated.");
    
    // 2. Upsert profile data
    console.log("[update-user] Step 4: Upserting public.profiles data...");
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
    console.log("[update-user] Step 4.1: public.profiles data upserted.");

    // 3. Handle work hours history
    if (hoursPerWeek !== null && hoursPerWeek !== undefined) {
      console.log(`[update-user] Step 5: Handling work hours. Received: ${hoursPerWeek}`);
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
        console.log("[update-user] Step 5.1: New work hours detected. Inserting new history record.");
        await supabaseAdmin.from('work_hours_history').insert({
          user_id: userId,
          hours_per_week: hoursPerWeek,
          effective_date: new Date().toISOString().split('T')[0], // Today's date
        });
        console.log("[update-user] Step 5.2: New history record inserted.");
      } else {
        console.log("[update-user] Step 5.1: Work hours are unchanged. Skipping history insert.");
      }
    }

    // 4. Update user roles, ONLY if roleIds are provided in the request
    if (roleIds !== undefined) {
      console.log(`[update-user] Step 6: Updating user roles. Received role IDs: ${roleIds}`);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
      console.log("[update-user] Step 6.1: Existing roles deleted.");
      if (roleIds && roleIds.length > 0) {
        const rolesToInsert = roleIds.map((roleId: number) => ({
          user_id: userId,
          role_id: roleId,
        }));
        await supabaseAdmin.from('user_roles').insert(rolesToInsert)
        console.log("[update-user] Step 6.2: New roles inserted.");
      }
    }

    console.log("--- [update-user] Function finished successfully ---");
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (e) {
    console.error("--- [update-user] FUNCTION CRASHED ---", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})