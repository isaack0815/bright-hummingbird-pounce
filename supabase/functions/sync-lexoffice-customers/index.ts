import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to map Lexoffice contact to our customer schema
const mapContactToCustomer = (contact: any, uuid: string) => {
  const isCompany = contact.company && contact.company.name;
  let customerData: any = { lex_id: uuid };
  let email: string | null = null;

  if (isCompany) {
    const company = contact.company;
    const billingAddress = (company.addresses?.billing?.[0]) || {};
    const contactPerson = (company.contactPersons?.[0]) || {};
    email = contactPerson.emailAddress || (company.emailAddresses?.business?.[0]);
    customerData = {
      ...customerData,
      company_name: company.name,
      contact_first_name: contactPerson.firstName,
      contact_last_name: contactPerson.lastName,
      email: email?.toLowerCase() || null,
      street: billingAddress.street,
      postal_code: billingAddress.zip,
      city: billingAddress.city,
      country: billingAddress.countryCode,
      tax_number: company.vatRegistrationId,
    };
  } else if (contact.person && (contact.person.firstName || contact.person.lastName)) {
    const person = contact.person;
    const addresses = person.addresses || {};
    const billingAddress = (addresses.business?.[0] || addresses.private?.[0]) || {};
    const emailAddresses = contact.emailAddresses || {};
    email = (emailAddresses.business?.[0] || emailAddresses.private?.[0] || emailAddresses.other?.[0]);
    customerData = {
      ...customerData,
      company_name: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
      contact_first_name: person.firstName,
      contact_last_name: person.lastName,
      email: email?.toLowerCase() || null,
      street: billingAddress.street,
      postal_code: billingAddress.zip,
      city: billingAddress.city,
      country: billingAddress.countryCode,
      tax_number: null,
    };
  } else {
    return null; // Skip if no name can be determined
  }
  
  if (!customerData.company_name) {
      return null;
  }

  customerData.house_number = null; // Lexoffice doesn't provide this separately
  return customerData;
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

    // 1. Fetch all contact summaries from Lexoffice
    const allContactSummaries = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(`https://api.lexoffice.io/v1/contacts?customer=true&page=${page}&size=100`, {
        headers: { 'Authorization': `Bearer ${lexApiKey}`, 'Accept': 'application/json' },
      });
      if (!response.ok) throw new Error(`Lexoffice API error: ${response.status} - ${await response.text()}`);
      
      const pageData = await response.json();
      if (pageData.content && pageData.content.length > 0) {
        allContactSummaries.push(...pageData.content);
        page++;
        hasMore = !pageData.last;
      } else {
        hasMore = false;
      }
    }

    // 2. Fetch full details for each contact to get the correct UUID
    const customersToUpsert = [];
    let skippedCount = 0;
    let apiErrorCount = 0;

    for (const summary of allContactSummaries) {
      try {
        const detailResponse = await fetch(`https://api.lexoffice.io/v1/contacts/${summary.id}`, {
          headers: { 'Authorization': `Bearer ${lexApiKey}`, 'Accept': 'application/json' },
        });

        if (!detailResponse.ok) {
          console.error(`Failed to fetch details for contact ${summary.id}: ${detailResponse.status}`);
          apiErrorCount++;
          continue;
        }

        const contactDetail = await detailResponse.json();
        const resourceUri = contactDetail.resourceUri;
        if (!resourceUri) {
          console.error(`No resourceUri for contact ${summary.id}`);
          skippedCount++;
          continue;
        }
        
        const uuid = resourceUri.substring(resourceUri.lastIndexOf('/') + 1);
        
        const mappedCustomer = mapContactToCustomer(contactDetail, uuid);
        if (mappedCustomer) {
          customersToUpsert.push(mappedCustomer);
        } else {
          skippedCount++;
        }
      } catch (e) {
        console.error(`Error processing contact ${summary.id}:`, e.message);
        apiErrorCount++;
      }
    }

    // 3. Perform a bulk upsert operation on the database
    if (customersToUpsert.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('customers')
        .upsert(customersToUpsert, { onConflict: 'lex_id' });
      if (upsertError) throw upsertError;
    }

    // 4. Return success response
    let message = `Synchronisierung abgeschlossen: ${customersToUpsert.length} Kunden erfolgreich verarbeitet.`;
    if (skippedCount > 0) message += ` ${skippedCount} Kontakte wurden übersprungen.`;
    if (apiErrorCount > 0) message += ` ${apiErrorCount} Kontakte konnten nicht abgerufen werden.`;

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    console.error("Error in sync-lexoffice-customers:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})