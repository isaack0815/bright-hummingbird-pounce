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
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { action, payload } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (action) {
      case 'import-orders': {
        const { customerId, orders, importFilePath, importFileName } = payload;
        if (!customerId || !Array.isArray(orders) || orders.length === 0) {
          return new Response(JSON.stringify({ error: 'Customer ID and a non-empty orders array are required.' }), { status: 400, headers: corsHeaders });
        }
        
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const [index, order] of orders.entries()) {
          try {
            const { stops, ...orderData } = order;
            const firstStop = stops && stops.length > 0 ? stops[0] : null;
            const lastStop = stops && stops.length > 0 ? stops[stops.length - 1] : null;

            const orderToInsert = {
              customer_id: customerId,
              external_order_number: orderData.external_order_number || null,
              status: 'Angelegt',
              origin_address: firstStop?.address || null,
              pickup_date: firstStop?.stop_date || null,
              destination_address: lastStop?.address || null,
              delivery_date: lastStop?.stop_date || null,
              price: orderData.price ? Number(orderData.price) : null,
              description: orderData.description || null,
              created_by: user.id,
            };

            const { data: newOrder, error: orderError } = await supabaseAdmin
              .from('freight_orders')
              .insert(orderToInsert)
              .select('id')
              .single();

            if (orderError) throw new Error(`Order insert failed: ${orderError.message}`);

            if (stops && stops.length > 0) {
              const stopsToInsert = stops.map((stop: any) => ({
                order_id: newOrder.id,
                address: stop.address,
                stop_type: stop.stop_type,
                stop_date: stop.stop_date,
                time_start: stop.time_start,
                position: stop.position,
              }));
              const { error: stopsError } = await supabaseAdmin.from('freight_order_stops').insert(stopsToInsert);
              if (stopsError) throw new Error(`Stops insert failed: ${stopsError.message}`);
            }

            if (orderData.weight || orderData.loading_meters) {
              const cargoItemToInsert = {
                order_id: newOrder.id,
                weight: orderData.weight ? Number(orderData.weight) : null,
                loading_meters: orderData.loading_meters ? Number(orderData.loading_meters) : null,
                description: orderData.description || 'Importierte Ladung',
                quantity: 1,
              };
              const { error: cargoError } = await supabaseAdmin.from('cargo_items').insert(cargoItemToInsert);
              if (cargoError) console.warn(`Order ${newOrder.id} created, but cargo item insert failed: ${cargoError.message}`);
            }
            
            if (importFilePath && importFileName) {
                const { error: fileError } = await supabaseAdmin.from('order_files').insert({
                    order_id: newOrder.id,
                    user_id: user.id,
                    file_path: importFilePath,
                    file_name: `[Import] ${importFileName}`,
                    file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    is_archived: true,
                });
                if (fileError) console.warn(`Order ${newOrder.id} created, but attaching import file failed: ${fileError.message}`);
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