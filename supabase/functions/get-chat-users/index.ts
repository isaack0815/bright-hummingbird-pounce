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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get all users from auth to ensure we have a complete list
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    // 2. Get all available profiles
    const userIds = authUsers.map(user => user.id);
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, username')
      .in('id', userIds);
    if (profilesError) throw profilesError;

    // 3. Create a map for easy lookup
    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    // 4. Combine the data, providing fallbacks for missing profiles
    const combinedUsers = authUsers.map(user => {
      const profile = profilesMap.get(user.id);
      const userMetaData = user.user_metadata || {};
      
      const firstName = profile?.first_name || userMetaData.first_name;
      const lastName = profile?.last_name || userMetaData.last_name;

      return {
        id: user.id,
        first_name: firstName || user.email?.split('@')[0] || 'Benutzer',
        last_name: lastName || '',
        username: profile?.username || null,
      };
    });

    return new Response(JSON.stringify({ users: combinedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})