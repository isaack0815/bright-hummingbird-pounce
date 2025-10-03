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
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // 1. Find the user's manager
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('manager_id, first_name, last_name')
      .eq('id', user.id)
      .single();
    
    if (profileError) throw profileError;
    if (!profile || !profile.manager_id) {
      return new Response(JSON.stringify({ error: 'Ihnen ist kein Vorgesetzter zugewiesen. Bitte kontaktieren Sie die Personalabteilung.' }), { status: 404 });
    }

    // 2. Get or create a conversation with the manager
    const { data: conversationData, error: rpcError } = await supabaseAdmin
      .rpc('get_or_create_conversation_with_user', {
        current_user_id: user.id,
        other_user_id: profile.manager_id
      });

    if (rpcError) throw rpcError;
    if (!conversationData || !conversationData.conversation_id) {
        throw new Error("Could not get or create conversation.");
    }

    // 3. Send the sick report message
    const sickMessage = `Automatische Nachricht: ${profile.first_name || ''} ${profile.last_name || ''} meldet sich für heute krank.`;
    const { error: messageError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        user_id: user.id,
        conversation_id: conversationData.conversation_id,
        content: sickMessage,
      });

    if (messageError) throw messageError;

    return new Response(JSON.stringify({ success: true, message: "Krankmeldung wurde an Ihren Vorgesetzten gesendet." }), {
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