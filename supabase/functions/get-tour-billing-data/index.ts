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

    const { year, month } = await req.json();
    if (year === undefined || month === undefined) {
        return new Response(JSON.stringify({ error: 'Year and month are required' }), { status: 400 });
    }

    const { data: setting, error: settingError } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'tour_billing_work_group_id')
      .single();
    if (settingError || !setting || !setting.value) {
      throw new Error('Arbeitsgruppe für die Abrechnung ist in den Einstellungen nicht konfiguriert.');
    }
    const workGroupId = Number(setting.value);

    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const { data: tours, error: toursError } = await supabaseAdmin
      .from('tours')
      .select('id, name')
      .order('name');
    if (toursError) throw toursError;

    const { data: rosterIds, error: rosterIdsError } = await supabaseAdmin
      .from('duty_rosters')
      .select('id')
      .eq('work_group_id', workGroupId);
    if (rosterIdsError) throw rosterIdsError;
    if (!rosterIds || rosterIds.length === 0) {
        return new Response(JSON.stringify({ tours: tours || [], billingData: {} }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('duty_roster_entries')
      .select('duty_date, tour_id, user_id, profiles(first_name, last_name)')
      .in('roster_id', rosterIds.map(r => r.id))
      .gte('duty_date', startDate)
      .lte('duty_date', endDate);
    if (entriesError) throw entriesError;

    const userIds = [...new Set(entries.map((e: any) => e.user_id))];
    if (userIds.length === 0) {
        return new Response(JSON.stringify({ tours: tours || [], billingData: {} }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('work_sessions')
      .select('user_id, start_time, start_km, end_km')
      .in('user_id', userIds)
      .gte('start_time', new Date(year, month, 1).toISOString())
      .lt('start_time', new Date(year, month + 1, 1).toISOString());
    if (sessionsError) throw sessionsError;

    const billingData: { [key: string]: { [key: number]: any } } = {};
    for (const entry of entries) {
      const dateKey = entry.duty_date;
      if (!billingData[dateKey]) {
        billingData[dateKey] = {};
      }
      
      const session = sessions.find((s: any) => 
        s.user_id === entry.user_id && 
        new Date(s.start_time).toDateString() === new Date(entry.duty_date).toDateString()
      );

      let kilometers = null;
      if (session && session.start_km != null && session.end_km != null) {
        kilometers = session.end_km - session.start_km;
      }

      billingData[dateKey][entry.tour_id] = {
        userId: entry.user_id,
        firstName: (entry.profiles as any)?.first_name,
        lastName: (entry.profiles as any)?.last_name,
        kilometers: kilometers,
      };
    }

    return new Response(JSON.stringify({ tours: tours || [], billingData }), {
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