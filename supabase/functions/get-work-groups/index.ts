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

    // 1. Get all work groups with their member IDs
    const { data: groups, error: groupsError } = await supabase
      .from('work_groups')
      .select(`
        *,
        user_work_groups(user_id)
      `)
      .order('name');

    if (groupsError) throw groupsError;
    if (!groups) {
        return new Response(JSON.stringify({ groups: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // 2. Collect all unique user IDs from all groups
    const userIds = [...new Set(groups.flatMap(g => g.user_work_groups.map((m: any) => m.user_id)))];

    if (userIds.length === 0) {
        const groupsWithEmptyMembers = groups.map(({ user_work_groups, ...rest }) => ({ ...rest, members: [] }));
        return new Response(JSON.stringify({ groups: groupsWithEmptyMembers }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // 3. Fetch all required profiles in one go
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds);
    if (profilesError) throw profilesError;

    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    // 4. Manually join the profiles to the groups
    const groupsWithMembers = groups.map(group => {
      const members = group.user_work_groups
        .map((m: any) => profilesMap.get(m.user_id))
        .filter(Boolean);
      const { user_work_groups, ...restOfGroup } = group;
      return { ...restOfGroup, members };
    });

    return new Response(JSON.stringify({ groups: groupsWithMembers }), {
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