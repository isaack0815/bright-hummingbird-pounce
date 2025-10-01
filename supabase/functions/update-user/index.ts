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

    const { userId, firstName, lastName, roleIds } = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Update user metadata in auth.users and profiles table
    await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: { first_name: firstName, last_name: lastName } }
    )
    
    await supabaseAdmin
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName })
      .eq('id', userId)

    // 2. Update user roles
    // First, delete existing roles for the user
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    // Then, insert the new roles if any are provided
    if (roleIds && roleIds.length > 0) {
      const rolesToInsert = roleIds.map((roleId: number) => ({
        user_id: userId,
        role_id: roleId,
      }));
      await supabaseAdmin
        .from('user_roles')
        .insert(rolesToInsert)
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