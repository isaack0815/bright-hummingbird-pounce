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

    const { year } = await req.json();
    if (!year) {
      return new Response(JSON.stringify({ error: 'Year is required' }), { status: 400 });
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: requests, error } = await supabase
      .from('vacation_requests')
      .select('user_id, start_date, end_date, profiles(id, first_name, last_name)')
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (error) throw error;

    // Group by user
    const vacationsByUser = requests.reduce((acc: any, req: any) => {
      if (!req.profiles) return acc;
      const userId = req.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          firstName: req.profiles.first_name,
          lastName: req.profiles.last_name,
          vacations: [],
        };
      }
      acc[userId].vacations.push({
        start: req.start_date,
        end: req.end_date,
      });
      return acc;
    }, {});

    return new Response(JSON.stringify({ vacations: Object.values(vacationsByUser) }), {
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