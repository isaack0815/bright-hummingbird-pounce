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

    switch (req.method) {
      case 'GET': {
        const { data, error } = await supabase.from('vehicle_groups').select('*').order('name');
        if (error) throw error;
        return new Response(JSON.stringify({ groups: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      case 'POST': {
        const { name, description } = await req.json();
        if (!name) throw new Error('Group name is required');
        const { data, error } = await supabase.from('vehicle_groups').insert([{ name, description }]).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ group: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      case 'PUT': {
        const { id, name, description } = await req.json();
        if (!id || !name) throw new Error('Group ID and name are required');
        const { data, error } = await supabase.from('vehicle_groups').update({ name, description }).eq('id', id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ group: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      case 'DELETE': {
        const { id } = await req.json();
        if (!id) throw new Error('Group ID is required');
        const { error } = await supabase.from('vehicle_groups').delete().eq('id', id);
        if (error) throw error;
        return new Response(null, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 204,
        });
      }
      default:
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})