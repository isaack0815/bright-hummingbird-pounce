import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple CSV parser
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    rows.push(row);
  }
  return rows;
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

    const { customerId, templateId, fileContent } = await req.json();
    if (!customerId || !templateId || !fileContent) {
      throw new Error("CustomerId, templateId, and fileContent are required.");
    }

    // 1. Fetch the import template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('import_templates')
      .select('mapping')
      .eq('id', templateId)
      .single();
    if (templateError) throw new Error(`Template not found: ${templateError.message}`);
    const mapping = template.mapping as Record<string, string>;

    // 2. Parse the CSV file
    const parsedData = parseCSV(fileContent);
    if (parsedData.length === 0) {
      throw new Error("CSV file is empty or invalid.");
    }

    // 3. Map CSV data to freight_orders schema
    const ordersToInsert = parsedData.map(row => {
      const newOrder: Record<string, any> = { customer_id: customerId };
      for (const csvHeader in mapping) {
        const dbColumn = mapping[csvHeader];
        if (row[csvHeader] !== undefined) {
          newOrder[dbColumn] = row[csvHeader];
        }
      }
      return newOrder;
    });

    // 4. Insert new orders into the database
    const { data: newOrders, error: insertError } = await supabaseAdmin
      .from('freight_orders')
      .insert(ordersToInsert)
      .select('id, order_number');

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${newOrders.length} Aufträge erfolgreich importiert.`,
      createdOrders: newOrders,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})