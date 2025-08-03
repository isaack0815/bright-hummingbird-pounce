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
      return new Response(JSON.stringify({ error: 'invoiceId is required' }), { status: 400 });
    }

    const fileResponse = await fetch(`https://api.lexoffice.io/v1/vouchers/${invoiceId}?download=true`, {
      headers: {
        'Authorization': `Bearer ${lexApiKey}`,
        'Accept': 'application/pdf',
      },
    });

    if (!fileResponse.ok) {
      throw new Error(`Lexoffice API error (fetching file): ${fileResponse.status} - ${await fileResponse.text()}`);
    }

    const pdfBlob = await fileResponse.blob();

    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="rechnung-${invoiceId}.pdf"`);

    return new Response(pdfBlob, { headers, status: 200 });

  } catch (e) {
    console.error("Error in get-lexoffice-invoice-pdf:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})