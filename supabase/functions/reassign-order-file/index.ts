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

    const { fileId, newOrderId } = await req.json()
    if (!fileId || !newOrderId) {
      return new Response(JSON.stringify({ error: 'File ID and new Order ID are required' }), { status: 400 })
    }

    // 1. Get the old file path
    const { data: file, error: fetchError } = await supabaseAdmin
      .from('order_files')
      .select('file_path')
      .eq('id', fileId)
      .single()
    if (fetchError) throw fetchError

    // 2. Move the file in storage
    const oldPath = file.file_path
    const newPath = oldPath.replace(/^\d+\//, `${newOrderId}/`)
    const { error: moveError } = await supabaseAdmin.storage.from('order-files').move(oldPath, newPath)
    if (moveError) throw moveError

    // 3. Update the database record
    const { error: updateError } = await supabaseAdmin
      .from('order_files')
      .update({ order_id: newOrderId, file_path: newPath })
      .eq('id', fileId)
    if (updateError) throw updateError

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