import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the anon key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    switch (action) {
      case 'login': {
        const user = url.searchParams.get('user'); // Assuming this is the email
        const pass = url.searchParams.get('pass');

        if (!user || !pass) {
          return new Response(JSON.stringify({ error: 'Benutzer und Passwort sind erforderlich' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: user,
          password: pass,
        });

        if (error) {
          return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten', details: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401, // Unauthorized
          });
        }

        // On success, return the session which includes the access token
        return new Response(JSON.stringify({ session: data.session }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      // Hier können in Zukunft weitere Aktionen hinzugefügt werden
      // case 'get_orders': { ... }

      default:
        return new Response(JSON.stringify({ error: 'Ungültige Aktion' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})