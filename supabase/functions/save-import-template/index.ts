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

    const { customerId, templateName, mapping, templateId } = await req.json();
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

    return new Response(JSON.stringify({ template: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})