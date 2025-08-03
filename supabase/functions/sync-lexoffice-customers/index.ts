import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to map Lexoffice contact to our customer schema
const mapContactToCustomer = (contact: any) => {
  const isCompany = contact.company && contact.company.name;
  let customerData: any = { lex_id: contact.id };
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

    // 1. Fetch all contacts from Lexoffice
    const allContacts = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(`https://api.lexoffice.io/v1/contacts?customer=true&page=${page}&size=100`, {
        headers: { 'Authorization': `Bearer ${lexApiKey}`, 'Accept': 'application/json' },
      });
      if (!response.ok) throw new Error(`Lexoffice API error: ${response.status} - ${await response.text()}`);
      
      const pageData = await response.json();
      if (pageData.content && pageData.content.length > 0) {
        allContacts.push(...pageData.content);
        page++;
        hasMore = !pageData.last;
      } else {
        hasMore = false;
      }
    }

    // 2. Fetch existing customers from our DB and create a lookup map based on lex_id
    const { data: existingCustomers, error: dbError } = await supabaseAdmin.from('customers').select('id, lex_id');
    if (dbError) throw dbError;

    const lexIdToDbId = new Map(existingCustomers.map(c => [c.lex_id, c.id]));

    // 3. Process contacts to decide whether to insert or update
    const customersToUpsert = [];
    let updatedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;

    for (const contact of allContacts) {
      const mappedCustomer = mapContactToCustomer(contact);
      if (!mappedCustomer) {
        skippedCount++;
        continue;
      }

      const existingDbId = lexIdToDbId.get(mappedCustomer.lex_id);

      if (existingDbId) {
        // Match by lex_id. This is an update.
        customersToUpsert.push({ id: existingDbId, ...mappedCustomer });
        updatedCount++;
      } else {
        // No match by lex_id. This is a new customer.
        customersToUpsert.push(mappedCustomer);
        insertedCount++;
      }
    }

    // 4. Perform the database operation
    if (customersToUpsert.length > 0) {
      const { error: upsertError } = await supabaseAdmin.from('customers').upsert(customersToUpsert);
      if (upsertError) throw upsertError;
    }

    // 5. Return success response
    let message = `Synchronisierung abgeschlossen: ${insertedCount} Kunden neu importiert, ${updatedCount} Kunden aktualisiert.`;
    if (skippedCount > 0) {
      message += ` ${skippedCount} Kontakte wurden übersprungen.`
    }

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