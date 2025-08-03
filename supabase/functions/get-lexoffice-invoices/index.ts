import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const fetchVouchersByStatus = async (lexApiKey: string, statuses: string): Promise<any[]> => {
  const allVouchers = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    // Add a delay before each request (except the first one) to avoid hitting the rate limit
    if (page > 0) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
    }

    const url = `https://api.lexoffice.io/v1/voucherlist?voucherType=invoice&voucherStatus=${statuses}&page=${page}&size=100`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${lexApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Lexoffice API error for status ${statuses}: ${response.status} - ${await response.text()}`);
    }

    const pageData = await response.json();
    if (pageData.content && pageData.content.length > 0) {
      allVouchers.push(...pageData.content);
      page++;
      hasMore = !pageData.last;
    } else {
      hasMore = false;
    }
  }
  return allVouchers;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const lexApiKey = Deno.env.get('LEX_API_KEY');
    if (!lexApiKey) throw new Error('LEX_API_KEY secret is not set in Supabase project.');

    // Step 1: Fetch our internal invoice IDs from the freight_orders table
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: localInvoices, error: dbError } = await supabaseAdmin
      .from('freight_orders')
      .select('lex_invoice_id')
      .not('lex_invoice_id', 'is', null);

    if (dbError) {
      throw new Error(`Database error fetching invoice IDs: ${dbError.message}`);
    }

    const localInvoiceIds = new Set(localInvoices.map(inv => inv.lex_invoice_id));
    if (localInvoiceIds.size === 0) {
        // No invoices created by our system, so return an empty array.
        return new Response(JSON.stringify({ invoices: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // Step 2: Fetch all invoices from Lexoffice
    const standardStatuses = 'open,paid,voided';
    const standardInvoices = await fetchVouchersByStatus(lexApiKey, standardStatuses);

    // Add a delay before the next batch of requests
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch invoices with overdue status
    const overdueStatus = 'overdue';
    const overdueInvoices = await fetchVouchersByStatus(lexApiKey, overdueStatus);
    
    // Combine the results
    const allLexofficeInvoices = [...standardInvoices, ...overdueInvoices];

    // Step 3: Filter Lexoffice invoices based on our internal IDs
    const filteredInvoices = allLexofficeInvoices.filter(invoice => localInvoiceIds.has(invoice.id));

    return new Response(JSON.stringify({ invoices: filteredInvoices }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    console.error("Error in get-lexoffice-invoices:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})