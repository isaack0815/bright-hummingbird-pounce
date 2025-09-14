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

    const { fileId } = await req.json()
    if (!fileId) {
      return new Response(JSON.stringify({ error: 'File ID is required' }), { status: 400 })
    }

    const { data: file, error: fetchError } = await supabaseAdmin
      .from('vehicle_files')
      .select('file_path')
      .eq('id', fileId)
      .single()
    if (fetchError) throw fetchError

    const { error: storageError } = await supabaseAdmin.storage.from('vehicle-files').remove([file.file_path])
    if (storageError) throw storageError

    const { error: dbError } = await supabaseAdmin.from('vehicle_files').delete().eq('id', fileId)
    if (dbError) throw dbError

    return new Response(null, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 204,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})