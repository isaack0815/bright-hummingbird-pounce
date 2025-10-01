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

    const { fileId } = await req.json();
    if (!fileId) {
      return new Response(JSON.stringify({ error: 'File ID is required' }), { status: 400 });
    }

    // Step 1: Fetch logs
    const { data: logs, error: logsError } = await supabase
      .from('file_activity_logs')
      .select('id, created_at, action, details, user_id')
      .eq('file_id', fileId)
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;
    if (!logs || logs.length === 0) {
        return new Response(JSON.stringify({ history: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Step 2: Collect user IDs
    const userIds = [...new Set(logs.map(log => log.user_id))];
    if (userIds.length === 0) {
        const historyWithoutProfiles = logs.map(log => ({ ...log, profiles: null }));
        return new Response(JSON.stringify({ history: historyWithoutProfiles }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Step 3: Fetch profiles for those user IDs
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds);
    if (profilesError) throw profilesError;

    // Step 4: Combine the data
    const profilesMap = new Map(profiles.map(p => [p.id, p]));
    const historyWithProfiles = logs.map(log => ({
      ...log,
      profiles: profilesMap.get(log.user_id) || null
    }));

    return new Response(JSON.stringify({ history: historyWithProfiles }), {
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