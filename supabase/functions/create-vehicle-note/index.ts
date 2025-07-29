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
    // Create a client to get the user from the auth header
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error("User not found")

    // Create an admin client to perform the insert, bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { vehicleId, categoryId, note } = await req.json()
    if (!vehicleId || !categoryId || !note) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    const { data, error } = await supabaseAdmin.from('vehicle_notes').insert({
        vehicle_id: vehicleId,
        category_id: categoryId,
        note: note,
        user_id: user.id
    }).select().single()

    if (error) throw error

    return new Response(JSON.stringify({ note: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})