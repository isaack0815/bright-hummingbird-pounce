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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { action, payload } = await req.json();

    switch (action) {
      case 'get': {
        const { customerId } = payload;
        if (!customerId) {
          return new Response(JSON.stringify({ error: 'Customer ID is required' }), { status: 400 });
        }
        const { data, error } = await supabase
          .from('import_templates')
          .select('*')
          .eq('customer_id', customerId)
          .order('template_name');
        if (error) throw error;
        return new Response(JSON.stringify({ templates: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'save': {
        const { customerId, templateName, mapping, templateId } = payload;
        if (!customerId || !templateName || !mapping) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
        }
        const upsertData = {
          id: templateId || undefined,
          customer_id: customerId,
          template_name: templateName,
          mapping: mapping,
          created_by: user.id,
        };
        const { data, error } = await supabase
          .from('import_templates')
          .upsert(upsertData)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ template: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'delete': {
        const { templateId } = payload;
        if (!templateId) {
          return new Response(JSON.stringify({ error: 'Template ID is required' }), { status: 400 });
        }
        const { error } = await supabase.from('import_templates').delete().eq('id', templateId);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
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