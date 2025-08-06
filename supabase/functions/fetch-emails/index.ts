import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import imaps from 'npm:imap-simple';
import { simpleParser } from 'npm:mailparser';

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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("User not found")

    // Use admin client to call security definer function
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: creds, error: credsError } = await supabaseAdmin
      .rpc('get_decrypted_email_credentials', { p_user_id: user.id })
      .single();
      
    if (credsError || !creds) {
      throw new Error("E-Mail-Konto nicht konfiguriert oder Abruffehler.");
    }

    const config = {
      imap: {
        user: creds.imap_username,
        password: creds.imap_password,
        host: Deno.env.get('SMTP_HOST')!,
        port: 993, // Standard IMAP SSL port
        tls: true,
        authTimeout: 3000
      }
    };

    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    const emails = [];

    for (const item of messages) {
      const allParts = item.parts.find(part => part.which === '');
      const id = item.attributes.uid;
      const idHeader = "Imap-Id: " + id + "\r\n";
      const mail = await simpleParser(idHeader + allParts.body);
      
      emails.push({
        uid: id,
        from: mail.from?.text,
        to: mail.to?.text,
        subject: mail.subject,
        date: mail.date,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments,
      });
    }

    connection.end();

    return new Response(JSON.stringify({ emails }), {
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