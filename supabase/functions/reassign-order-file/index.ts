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
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("User not authenticated for logging.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { fileId, newOrderId } = await req.json()
    if (!fileId || !newOrderId) {
      return new Response(JSON.stringify({ error: 'File ID and new Order ID are required' }), { status: 400 })
    }

    const { data: oldFile, error: fetchError } = await supabaseAdmin
      .from('order_files')
      .select('order_id, file_path')
      .eq('id', fileId)
      .single()
    if (fetchError) throw fetchError

    const oldPath = oldFile.file_path
    const newPath = oldPath.replace(/^\d+\//, `${newOrderId}/`)
    const { error: moveError } = await supabaseAdmin.storage.from('order-files').move(oldPath, newPath)
    if (moveError) throw moveError

    const { error: updateError } = await supabaseAdmin
      .from('order_files')
      .update({ order_id: newOrderId, file_path: newPath })
      .eq('id', fileId)
    if (updateError) throw updateError

    await supabaseAdmin.from('file_activity_logs').insert({
        file_id: fileId,
        user_id: user.id,
        action: 'reassigned',
        details: { from_order_id: oldFile.order_id, to_order_id: newOrderId }
    });

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