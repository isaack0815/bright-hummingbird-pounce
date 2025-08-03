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
    if (!lexApiKey) {
      throw new Error('LEX_API_KEY secret is not set in Supabase project.');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch existing customers and create maps for quick lookups.
    // Emails are normalized to lowercase to prevent case-sensitivity issues.
    const { data: existingCustomers, error: dbError } = await supabaseAdmin
      .from('customers')
      .select('id, lex_id, email');
    if (dbError) throw dbError;

    const existingLexIds = new Set(existingCustomers.map(c => c.lex_id).filter(Boolean));
    const emailToDbIdMap = new Map(existingCustomers.filter(c => c.email).map(c => [c.email.toLowerCase(), c.id]));

    // Fetch all contacts from Lexoffice, handling pagination.
    const allContacts = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(`https://api.lexoffice.io/v1/contacts?customer=true&page=${page}&size=100`, {
        headers: { 'Authorization': `Bearer ${lexApiKey}`, 'Accept': 'application/json' },
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

    const customersToInsert = [];
    const customersToUpdate = [];
    let skippedCount = 0;
    // This set tracks emails we are about to insert in this run to avoid duplicates within the batch.
    const newEmailsInThisBatch = new Set<string>();

    for (const contact of allContacts) {
      if (existingLexIds.has(contact.id)) {
        continue; // Already synced by lex_id, skip.
      }

      // Logic to parse contact data into a standardized format
      const isCompany = contact.company && contact.company.name;
      let customerData: any = { lex_id: contact.id };
      let contactEmail: string | null = null;

      if (isCompany) {
        const company = contact.company;
        const billingAddress = (company.addresses?.billing?.[0]) || {};
        const contactPerson = (company.contactPersons?.[0]) || {};
        contactEmail = contactPerson.emailAddress;
        customerData = { ...customerData, company_name: company.name, contact_first_name: contactPerson.firstName, contact_last_name: contactPerson.lastName, email: contactEmail, street: billingAddress.street, postal_code: billingAddress.zip, city: billingAddress.city, country: billingAddress.countryCode, tax_number: company.vatRegistrationId };
      } else if (contact.person && (contact.person.firstName || contact.person.lastName)) {
        const person = contact.person;
        const addresses = person.addresses || {};
        const billingAddress = (addresses.business?.[0] || addresses.private?.[0]) || {};
        const emailAddresses = contact.emailAddresses || {};
        contactEmail = (emailAddresses.business?.[0] || emailAddresses.private?.[0] || emailAddresses.other?.[0]);
        customerData = { ...customerData, company_name: `${person.firstName || ''} ${person.lastName || ''}`.trim(), contact_first_name: person.firstName, contact_last_name: person.lastName, email: contactEmail, street: billingAddress.street, postal_code: billingAddress.zip, city: billingAddress.city, country: billingAddress.countryCode, tax_number: null };
      } else {
        skippedCount++;
        continue;
      }

      if (!customerData.company_name) {
        skippedCount++;
        continue;
      }
      
      customerData.house_number = null;
      const lowerCaseEmail = contactEmail ? contactEmail.toLowerCase() : null;
      if (lowerCaseEmail) {
        customerData.email = lowerCaseEmail; // Ensure we store the normalized email
      }

      // Decide whether to insert, update, or skip
      if (lowerCaseEmail && emailToDbIdMap.has(lowerCaseEmail)) {
        // Email exists in DB -> update existing record
        const dbId = emailToDbIdMap.get(lowerCaseEmail);
        customersToUpdate.push({ id: dbId, ...customerData });
      } else if (lowerCaseEmail && newEmailsInThisBatch.has(lowerCaseEmail)) {
        // Email is a duplicate within this sync batch -> skip
        skippedCount++;
        continue;
      } else {
        // New customer -> add to insert list
        customersToInsert.push(customerData);
        if (lowerCaseEmail) {
          newEmailsInThisBatch.add(lowerCaseEmail);
        }
      }
    }

    // Perform DB operations
    if (customersToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('customers').insert(customersToInsert);
      if (insertError) throw insertError;
    }

    if (customersToUpdate.length > 0) {
      const { error: updateError } = await supabaseAdmin.from('customers').upsert(customersToUpdate);
      if (updateError) throw updateError;
    }

    let message = `Synchronisierung abgeschlossen: ${customersToInsert.length} neue Kunden importiert, ${customersToUpdate.length} bestehende Kunden aktualisiert.`;
    if (skippedCount > 0) {
      message += ` ${skippedCount} Kontakte wurden übersprungen (Duplikate oder fehlende Daten).`
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