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
    const lexApiKey = Deno.env.get('LEX_API_KEY');
    if (!lexApiKey) throw new Error('LEX_API_KEY secret is not set in Supabase project.');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orderIds, customerId } = await req.json();
    if (!orderIds || orderIds.length === 0 || !customerId) {
      throw new Error("Order IDs and Customer ID are required.");
    }

    // 1. Fetch customer details, especially the lex_id
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('lex_id, company_name, street, house_number, postal_code, city, country')
      .eq('id', customerId)
      .single();
    if (customerError || !customer || !customer.lex_id) {
      throw new Error("Customer not found or missing Lexoffice ID.");
    }

    // 2. Fetch selected orders
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('freight_orders')
      .select('id, order_number, price, origin_address, destination_address')
      .in('id', orderIds);
    if (ordersError) throw ordersError;

    // 3. Construct Lexoffice invoice payload
    const lineItems = orders.map(order => ({
      type: "service",
      name: `Transportauftrag ${order.order_number}`,
      description: `Strecke: ${order.origin_address} -> ${order.destination_address}`,
      quantity: 1,
      unitName: "Stück",
      unitPrice: {
        currency: "EUR",
        netAmount: order.price || 0,
        taxRatePercentage: 19,
      },
    }));

    const lexofficePayload = {
      archived: false, // This creates a draft
      voucherDate: new Date().toISOString(),
      address: {
        contactId: customer.lex_id,
        name: customer.company_name,
        street: `${customer.street || ''} ${customer.house_number || ''}`.trim(),
        zip: customer.postal_code,
        city: customer.city,
        countryCode: customer.country,
      },
      lineItems,
      taxConditions: {
        taxType: "net",
      },
      title: "Sammelrechnung",
    };

    // 4. Send to Lexoffice
    const lexResponse = await fetch('https://api.lexoffice.io/v1/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lexApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(lexofficePayload),
    });

    if (!lexResponse.ok) {
      const errorBody = await lexResponse.text();
      throw new Error(`Lexoffice API Error: ${lexResponse.status} - ${errorBody}`);
    }

    const lexData = await lexResponse.json();
    const newInvoiceId = lexData.id;

    // 5. Update local orders with the new invoice ID and set as billed
    const { error: updateError } = await supabaseAdmin
      .from('freight_orders')
      .update({ is_billed: true, lex_invoice_id: newInvoiceId })
      .in('id', orderIds);

    if (updateError) {
      console.error(`CRITICAL: Invoice created in Lexoffice (ID: ${newInvoiceId}) but failed to update local orders. Error: ${updateError.message}`);
      throw new Error(`Invoice created in Lexoffice, but failed to update local orders. Please check logs.`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Rechnungsentwurf in Lexoffice mit ID ${newInvoiceId} erstellt.`,
      invoiceId: newInvoiceId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    console.error("Error in create-lexoffice-invoice:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})