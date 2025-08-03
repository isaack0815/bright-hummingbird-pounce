import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

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

    // Fetch invoices with standard statuses
    const standardStatuses = 'open,paid,voided';
    const standardInvoices = await fetchVouchersByStatus(lexApiKey, standardStatuses);

    // Add a delay before the next batch of requests
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch invoices with overdue status
    const overdueStatus = 'overdue';
    const overdueInvoices = await fetchVouchersByStatus(lexApiKey, overdueStatus);
    
    // Combine the results
    const allInvoices = [...standardInvoices, ...overdueInvoices];

    return new Response(JSON.stringify({ invoices: allInvoices }), {
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