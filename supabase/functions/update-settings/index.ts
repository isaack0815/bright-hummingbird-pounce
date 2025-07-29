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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const settingsToUpdate = await req.json() // Expects an array of { key: string, value: string }

    if (!Array.isArray(settingsToUpdate)) {
        return new Response(JSON.stringify({ error: 'Request body must be an array of settings' }), { status: 400 })
    }

    const upsertPromises = settingsToUpdate.map(setting => 
        supabase.from('settings').upsert(setting)
    )

    const results = await Promise.all(upsertPromises)
    const firstError = results.find(res => res.error)

    if (firstError && firstError.error) throw firstError.error

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