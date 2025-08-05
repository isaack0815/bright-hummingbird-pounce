import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const fetchVouchers = async (lexApiKey: string, contactId: string): Promise<any[]> => {
  const allVouchers = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    if (page > 0) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
    }

    const url = `https://api.lexoffice.io/v1/voucherlist?voucherType=invoice&contactId=${contactId}&page=${page}&size=100`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${lexApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Lexoffice API error: ${response.status} - ${await response.text()}`);
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

    const { lexContactId } = await req.json();
    if (!lexContactId) {
      return new Response(JSON.stringify({ error: 'lexContactId is required' }), { status: 400 });
    }

    const invoices = await fetchVouchers(lexApiKey, lexContactId);

    return new Response(JSON.stringify({ invoices }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    console.error("Error in get-lexoffice-invoices-by-customer:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})