import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const lexApiKey = Deno.env.get('LEX_API_KEY');
    if (!lexApiKey) throw new Error('LEX_API_KEY secret is not set in Supabase project.');

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'Invoice ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const lexResponse = await fetch(`https://api.lexoffice.io/v1/invoices/${invoiceId}/document`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lexApiKey}`,
        'Accept': 'application/pdf',
      },
    });

    if (!lexResponse.ok) {
      const errorBody = await lexResponse.text();
      throw new Error(`Lexoffice API Error: ${lexResponse.status} - ${errorBody}`);
    }

    const pdfBlob = await lexResponse.blob();

    return new Response(pdfBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
      },
      status: 200,
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})