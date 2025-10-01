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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (req.method) {
      case 'GET': {
        const { data, error } = await supabase.from('customers').select('*').order('company_name')
        if (error) throw error
        return new Response(JSON.stringify({ customers: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      case 'POST': {
        const lexApiKey = Deno.env.get('LEX_API_KEY');
        if (!lexApiKey) throw new Error('LEX_API_KEY secret is not set in Supabase project.');
        
        const customerData = await req.json()
        const lexofficePayload: any = {
          version: 0,
          roles: { customer: {} },
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
            lexofficePayload.company.emailAddresses = { business: [customerData.email] }
        }

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
          throw new Error(`Lexoffice API Error: ${lexResponse.status} - ${errorBody}`);
        }

        const lexData = await lexResponse.json();
        const lexId = lexData.id;
        if (!lexId) {
            throw new Error("Lexoffice did not return an ID for the new contact.");
        }

        const finalCustomerData = { ...customerData, lex_id: lexId };
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert(finalCustomerData)
          .select()
          .single()
        if (insertError) {
            console.error(`CRITICAL: Customer created in Lexoffice (lex_id: ${lexId}) but failed to save to local DB. Error: ${insertError.message}`);
            throw new Error(`Customer created in Lexoffice, but failed to save locally. Please check logs. DB Error: ${insertError.message}`);
        }

        return new Response(JSON.stringify({ customer: newCustomer }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        })
      }
      case 'PUT': {
        const { id, ...updateData } = await req.json()
        if (!id) throw new Error('Customer ID is required')
        const { data, error } = await supabase.from('customers').update(updateData).eq('id', id).select().single()
        if (error) throw error
        return new Response(JSON.stringify({ customer: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      case 'DELETE': {
        const { id } = await req.json()
        if (!id) throw new Error('Customer ID is required')
        const { error } = await supabase.from('customers').delete().eq('id', id)
        if (error) throw error
        return new Response(null, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 204,
        })
      }
      default:
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})