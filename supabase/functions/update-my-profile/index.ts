import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0' // Use a specific, stable version

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Authorization header is missing. The request could not be authenticated.");
    }

    // Step 1: Authenticate the user with their token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`);
    }
    if (!user) {
      throw new Error("Authentication failed: Could not retrieve user from the provided token.");
    }

    const { firstName, lastName, username, email_signature } = await req.json()

    if (!firstName || !lastName || !username) {
      return new Response(JSON.stringify({ error: 'First name, last name, and username are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Step 2: Use an admin client for the updates for robustness
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update user metadata in auth.users
    const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { user_metadata: { first_name: firstName, last_name: lastName, username } }
    )
    if (updateUserError) throw updateUserError

    // Upsert the public.profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: user.id, first_name: firstName, last_name: lastName, username, email_signature })
    if (profileError) throw profileError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (e) {
    console.error("[update-my-profile] Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})