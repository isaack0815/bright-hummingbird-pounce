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
    )

    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;
    
    const hasPermission = permissions.some((p: { permission_name: string }) => p.permission_name === 'Abrechnung Fernverkehr');
    if (!hasPermission) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const { orderId, orderData, lineItems } = await req.json();
    if (!orderId || !orderData || !lineItems) {
      return new Response(JSON.stringify({ error: 'Missing required data' }), { status: 400, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Update the main order details
    const { error: orderUpdateError } = await supabaseAdmin
      .from('freight_orders')
      .update({
        is_intra_community: orderData.is_intra_community,
        total_discount: orderData.total_discount,
        total_discount_type: orderData.total_discount_type,
      })
      .eq('id', orderId);
    if (orderUpdateError) throw orderUpdateError;

    // 2. Get existing line item IDs for this order
    const { data: existingItems, error: fetchError } = await supabaseAdmin
      .from('billing_line_items')
      .select('id')
      .eq('order_id', orderId);
    if (fetchError) throw fetchError;
    const existingIds = existingItems.map(item => item.id);

    // 3. Upsert the new/updated line items
    const itemsToUpsert = lineItems.map((item: any) => ({
        ...item,
        order_id: orderId,
    }));
    const { data: upsertedItems, error: upsertError } = await supabaseAdmin
        .from('billing_line_items')
        .upsert(itemsToUpsert)
        .select('id');
    if (upsertError) throw upsertError;
    const upsertedIds = upsertedItems.map(item => item.id);

    // 4. Delete any line items that were removed in the UI
    const idsToDelete = existingIds.filter(id => !upsertedIds.includes(id));
    if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
            .from('billing_line_items')
            .delete()
            .in('id', idsToDelete);
        if (deleteError) throw deleteError;
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