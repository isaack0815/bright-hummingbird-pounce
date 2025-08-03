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

    // 1. Insert customer into local DB first
    const { data: newCustomer, error: insertError } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single()

    if (insertError) throw insertError

    // 2. Prepare payload for Lexoffice
    const lexofficePayload: any = {
      version: 0,
      roles: {
        customer: {}
      },
      company: {
        name: newCustomer.company_name,
        vatRegistrationId: newCustomer.tax_number,
        addresses: {
          billing: [{
            street: `${newCustomer.street || ''} ${newCustomer.house_number || ''}`.trim(),
            zip: newCustomer.postal_code,
            city: newCustomer.city,
            countryCode: newCustomer.country,
          }]
        }
      }
    };

    if (newCustomer.contact_first_name || newCustomer.contact_last_name) {
      lexofficePayload.company.contactPersons = [{
        firstName: newCustomer.contact_first_name,
        lastName: newCustomer.contact_last_name,
        emailAddress: newCustomer.email,
      }];
    }
    
    if (newCustomer.email && !lexofficePayload.company.contactPersons) {
        lexofficePayload.company.emailAddresses = {
            business: [newCustomer.email]
        }
    }

    // 3. Send to Lexoffice
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
      // The customer is created locally, but Lexoffice sync failed.
      // We will throw an error to notify the user. The local customer will remain.
      throw new Error(`Lexoffice API Error: ${lexResponse.status} - ${errorBody}`);
    }

    const lexData = await lexResponse.json();
    const lexId = lexData.id;

    // 4. Update local customer with lex_id
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({ lex_id: lexId })
      .eq('id', newCustomer.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 5. Return the final, updated customer data
    return new Response(JSON.stringify({ customer: updatedCustomer }), {
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