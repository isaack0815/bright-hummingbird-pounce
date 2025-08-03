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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const customerData = await req.json()

    // 1. Prepare payload for Lexoffice
    const lexofficePayload: any = {
      version: 0,
      roles: {
        customer: {}
      },
      company: {
        name: customerData.company_name,
        vatRegistrationId: customerData.tax_number,
        addresses: {
          billing: [{
            street: `${customerData.street || ''} ${customerData.house_number || ''}`.trim(),
            zip: customerData.postal_code,
            city: customerData.city,
            countryCode: customerData.country,
          }]
        }
      }
    };

    if (customerData.contact_first_name || customerData.contact_last_name) {
      lexofficePayload.company.contactPersons = [{
        firstName: customerData.contact_first_name,
        lastName: customerData.contact_last_name,
        emailAddress: customerData.email,
      }];
    }
    
    if (customerData.email && !lexofficePayload.company.contactPersons) {
        lexofficePayload.company.emailAddresses = {
            business: [customerData.email]
        }
    }

    // 2. Send to Lexoffice FIRST
    const lexResponse = await fetch('https://api.lexoffice.io/v1/contacts', {
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
      // If Lexoffice fails, we don't create the customer locally.
      throw new Error(`Lexoffice API Error: ${lexResponse.status} - ${errorBody}`);
    }

    const lexData = await lexResponse.json();
    const resourceUri = lexData.resourceUri;
    if (!resourceUri) {
        throw new Error("Lexoffice did not return a resourceUri for the new contact.");
    }
    const lexId = resourceUri.substring(resourceUri.lastIndexOf('/') + 1);


    // 3. If Lexoffice succeeds, insert the customer into local DB with the new lex_id
    const finalCustomerData = {
        ...customerData,
        lex_id: lexId
    };

    const { data: newCustomer, error: insertError } = await supabase
      .from('customers')
      .insert(finalCustomerData)
      .select()
      .single()

    if (insertError) {
        console.error(`CRITICAL: Customer created in Lexoffice (lex_id: ${lexId}) but failed to save to local DB. Error: ${insertError.message}`);
        throw new Error(`Customer created in Lexoffice, but failed to save locally. Please check logs. DB Error: ${insertError.message}`);
    }

    // 4. Return the final, created customer data
    return new Response(JSON.stringify({ customer: newCustomer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})