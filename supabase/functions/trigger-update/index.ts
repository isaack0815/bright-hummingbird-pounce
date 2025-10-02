import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (_req) => {
  if (_req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const WEBHOOK_URL = Deno.env.get('WEBHOOK_URL');
    const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

    if (!WEBHOOK_URL || !WEBHOOK_SECRET) {
      throw new Error('WEBHOOK_URL and WEBHOOK_SECRET must be set in Supabase secrets.');
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-update-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({ trigger: 'supabase-function' }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Webhook server responded with ${response.status}: ${errorBody}`);
    }

    const responseData = await response.json();

    return new Response(JSON.stringify({ success: true, message: 'Update initiated.', details: responseData }), {
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