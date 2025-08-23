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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { action, payload } = await req.json();

    switch (action) {
      case 'get': {
        const { data, error } = await supabase.from('customers').select('*').order('company_name');
        if (error) throw error;
        return new Response(JSON.stringify({ customers: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'create': {
        const lexApiKey = Deno.env.get('LEX_API_KEY');
        if (!lexApiKey) throw new Error('LEX_API_KEY secret is not set in Supabase project.');
        
        const customerData = payload;
        const lexofficePayload: any = {
          version: 0,
          roles: { customer: {} },
          company: {
            name: customerData.company_name,
            vatRegistrationId: customerData.tax_number,
            addresses: { billing: [{ street: `${customerData.street || ''} ${customerData.house_number || ''}`.trim(), zip: customerData.postal_code, city: customerData.city, countryCode: customerData.country }] }
          }
        };
        if (customerData.contact_first_name || customerData.contact_last_name) {
          lexofficePayload.company.contactPersons = [{ firstName: customerData.contact_first_name, lastName: customerData.contact_last_name, emailAddress: customerData.email }];
        }
        if (customerData.email && !lexofficePayload.company.contactPersons) {
            lexofficePayload.company.emailAddresses = { business: [customerData.email] }
        }

        const lexResponse = await fetch('https://api.lexoffice.io/v1/contacts', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${lexApiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(lexofficePayload),
        });
        if (!lexResponse.ok) {
          const errorBody = await lexResponse.text();
          throw new Error(`Lexoffice API Error: ${lexResponse.status} - ${errorBody}`);
        }
        const lexData = await lexResponse.json();
        const lexId = lexData.id;
        if (!lexId) throw new Error("Lexoffice did not return an ID for the new contact.");

        const finalCustomerData = { ...customerData, lex_id: lexId };
        const { data: newCustomer, error: insertError } = await supabase.from('customers').insert(finalCustomerData).select().single();
        if (insertError) {
            console.error(`CRITICAL: Customer created in Lexoffice (lex_id: ${lexId}) but failed to save to local DB. Error: ${insertError.message}`);
            throw new Error(`Customer created in Lexoffice, but failed to save locally. Please check logs. DB Error: ${insertError.message}`);
        }
        return new Response(JSON.stringify({ customer: newCustomer }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }

      case 'update': {
        const { id, ...updateData } = payload;
        if (!id) return new Response(JSON.stringify({ error: 'Customer ID is required' }), { status: 400 });
        const { data, error } = await supabase.from('customers').update(updateData).eq('id', id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ customer: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'delete': {
        const { id } = payload;
        if (!id) return new Response(JSON.stringify({ error: 'Customer ID is required' }), { status: 400 });
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) throw error;
        return new Response(null, { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 204 });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})