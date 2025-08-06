import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requestData = {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      body: await req.text(),
    };

    console.log("--- [debug-cron-request] RECEIVED REQUEST ---");
    console.log(JSON.stringify(requestData, null, 2));
    console.log("--------------------------------------------");

    return new Response(JSON.stringify({ success: true, message: "Request logged." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error("--- [debug-cron-request] ERROR ---");
    console.error(e);
    console.log("------------------------------------");
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})