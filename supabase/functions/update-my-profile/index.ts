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
    // Create a Supabase client with the user's auth token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the user from the token
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error("User not found")

    const { firstName, lastName, username } = await req.json()

    if (!firstName || !lastName || !username) {
      return new Response(JSON.stringify({ error: 'First name, last name, and username are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Update user metadata in auth.users
    const { data: updatedUser, error: updateUserError } = await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName, username }
    })
    if (updateUserError) throw updateUserError

    // Upsert the public.profiles table to create a profile if it doesn't exist
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, first_name: firstName, last_name: lastName, username })
    if (profileError) throw profileError

    return new Response(JSON.stringify({ user: updatedUser.user }), {
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