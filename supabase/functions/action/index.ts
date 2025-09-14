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
    const { action, payload } = await req.json();
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    const { data: { user } } = await supabase.auth.getUser()

    switch (action) {
      case 'login': {
        const { username, password } = payload;
        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Benutzername und Passwort sind erforderlich' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

        if (userError || !authUser || !authUser.email) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const { data: sessionData, error: signInError } = await createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        ).auth.signInWithPassword({
            email: authUser.email,
            password: password,
        });

        if (signInError) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ session: sessionData.session }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'get-file-structure': {
        if (!user) throw new Error("User not found")

        const { data: folders, error: foldersError } = await supabase
          .from('folders')
          .select('*')
          .eq('created_by', user.id)

        if (foldersError) throw foldersError

        const { data: files, error: filesError } = await supabase
          .from('files')
          .select('*')
          .eq('created_by', user.id)

        if (filesError) throw filesError

        return new Response(JSON.stringify({ folders, files }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      case 'create-folder': {
        if (!user) throw new Error("User not found")
        const { name, parent_folder_id } = payload;

        if (!name) {
          return new Response(JSON.stringify({ error: 'Folder name is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }

        const { data, error } = await supabase
          .from('folders')
          .insert({ name, parent_folder_id: parent_folder_id || null })
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ folder: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
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