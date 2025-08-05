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
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    switch (action) {
      case 'login': {
        const username = url.searchParams.get('user');
        const pass = url.searchParams.get('pass');

        if (!username || !pass) {
          return new Response(JSON.stringify({ error: 'Benutzername und Passwort sind erforderlich' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        // Use service role key to find user email from username
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Find profile by username
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten', details: 'Benutzer nicht gefunden' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        // 2. Get user email from auth schema using the ID
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

        if (userError || !user || !user.email) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten', details: 'Fehler beim Abrufen der Benutzerdaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        // 3. Attempt to sign in with the found email and provided password
        // Use the public client for this, as signInWithPassword is a client-side method
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        );

        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: pass,
        });

        if (signInError) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten', details: signInError.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        // On success, return the session
        return new Response(JSON.stringify({ session: sessionData.session }), {
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