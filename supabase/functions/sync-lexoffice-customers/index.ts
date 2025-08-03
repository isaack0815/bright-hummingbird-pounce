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
    // 1. Get API Key from secrets
    const lexApiKey = Deno.env.get('LEX_API_KEY');
    if (!lexApiKey) {
      throw new Error('LEX_API_KEY secret is not set in Supabase project.');
    }

    // 2. Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Fetch all existing customers' lex_id from our DB
    const { data: existingCustomers, error: dbError } = await supabaseAdmin
      .from('customers')
      .select('lex_id')
      .not('lex_id', 'is', null);
    if (dbError) throw dbError;
    const existingLexIds = new Set(existingCustomers.map(c => c.lex_id));

    // 4. Fetch all contacts from Lexoffice (handles pagination)
    const allContacts = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`https://api.lexoffice.io/v1/contacts?customer=true&page=${page}&size=100`, {
        headers: {
          'Authorization': `Bearer ${lexApiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Lexoffice API error: ${response.status} - ${errorBody}`);
      }

      const pageData = await response.json();
      if (pageData.content && pageData.content.length > 0) {
        allContacts.push(...pageData.content);
        page++;
        hasMore = !pageData.last;
      } else {
        hasMore = false;
      }
    }

    // 5. Filter for new contacts
    const newContacts = allContacts.filter(contact => !existingLexIds.has(contact.id));

    if (newContacts.length === 0) {
      return new Response(JSON.stringify({ message: 'Alle Kunden sind bereits auf dem neuesten Stand.', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 6. Map and insert new contacts
    const customersToInsert = newContacts.map(contact => {
      const company = contact.company || {};
      const billingAddress = (company.addresses && company.addresses.billing && company.addresses.billing[0]) ? company.addresses.billing[0] : {};
      const contactPerson = (company.contactPersons && company.contactPersons[0]) ? company.contactPersons[0] : {};

      return {
        lex_id: contact.id,
        company_name: company.name,
        contact_first_name: contactPerson.firstName,
        contact_last_name: contactPerson.lastName,
        email: contactPerson.emailAddress,
        street: billingAddress.street,
        postal_code: billingAddress.zip,
        city: billingAddress.city,
        country: billingAddress.countryCode,
        tax_number: company.vatRegistrationId,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from('customers')
      .insert(customersToInsert);

    if (insertError) throw insertError;

    // 7. Return success response
    return new Response(JSON.stringify({ message: `${newContacts.length} neue Kunden erfolgreich importiert.`, count: newContacts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    console.error("Error in sync-lexoffice-customers:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})