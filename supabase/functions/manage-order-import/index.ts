import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Use user client only to get the authenticated user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { action, payload } = await req.json();

    // Use admin client for all database operations to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (action) {
      case 'import-orders': {
        const { customerId, orders } = payload;
        if (!customerId || !Array.isArray(orders) || orders.length === 0) {
          return new Response(JSON.stringify({ error: 'Customer ID and a non-empty orders array are required.' }), { status: 400, headers: corsHeaders });
        }
        
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const [index, order] of orders.entries()) {
          try {
            const orderToInsert = {
              customer_id: customerId,
              external_order_number: order.external_order_number || null,
              status: 'Angelegt',
              origin_address: order.origin_address || null,
              pickup_date: order.pickup_date || null,
              destination_address: order.destination_address || null,
              delivery_date: order.delivery_date || null,
              price: order.price ? Number(order.price) : null,
              description: order.description || null,
              created_by: user.id,
            };

            const { data: newOrder, error: orderError } = await supabaseAdmin
              .from('freight_orders')
              .insert(orderToInsert)
              .select('id')
              .single();

            if (orderError) {
              throw new Error(`Order insert failed: ${orderError.message}`);
            }

            if (order.weight || order.loading_meters) {
              const cargoItemToInsert = {
                order_id: newOrder.id,
                weight: order.weight ? Number(order.weight) : null,
                loading_meters: order.loading_meters ? Number(order.loading_meters) : null,
                description: order.description || 'Importierte Ladung',
                quantity: 1,
              };
              const { error: cargoError } = await supabaseAdmin
                .from('cargo_items')
                .insert(cargoItemToInsert);

              if (cargoError) {
                console.warn(`Order ${newOrder.id} created, but cargo item insert failed: ${cargoError.message}`);
              }
            }
            
            successCount++;
          } catch (e) {
            errorCount++;
            errors.push(`Order ${index + 1}: ${e.message}`);
          }
        }

        return new Response(JSON.stringify({ successCount, errorCount, totalCount: orders.length, errors }), { status: 200, headers: corsHeaders });
      }

      case 'get-templates': {
        const { customerId } = payload;
        if (!customerId) return new Response(JSON.stringify({ error: 'Customer ID is required' }), { status: 400, headers: corsHeaders });
        const { data, error } = await supabaseAdmin.from('import_templates').select('*').eq('customer_id', customerId).order('template_name');
        if (error) throw error;
        return new Response(JSON.stringify({ templates: data || [] }), { status: 200, headers: corsHeaders });
      }

      case 'save-template': {
        const { customerId, templateName, mapping, templateId } = payload;
        if (!customerId || !templateName || !mapping) return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
        const upsertData = { id: templateId || undefined, customer_id: customerId, template_name: templateName, mapping: mapping, created_by: user.id };
        const { data, error } = await supabaseAdmin.from('import_templates').upsert(upsertData).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ template: data }), { status: 200, headers: corsHeaders });
      }

      case 'delete-template': {
        const { templateId } = payload;
        if (!templateId) return new Response(JSON.stringify({ error: 'Template ID is required' }), { status: 400, headers: corsHeaders });
        const { error } = await supabaseAdmin.from('import_templates').delete().eq('id', templateId);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
})