import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow@1.0.155';
import { simpleParser } from 'npm:mailparser';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper functions from ChatGPT script
const formatAddress = (addr: any): string | null => {
  if (!addr || !addr.value || addr.value.length === 0) return null;
  const { name, address } = addr.value[0];
  if (!address) return null;
  return name ? `"${name}" <${address}>` : `<${address}>`;
}

async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fetchAndStoreEmails() {
  console.log("--- [test-single-email-sync] Starting ---");

  // Get secrets from environment
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const imapHost = Deno.env.get('IMAP_HOST');
  const imapUser = Deno.env.get('IMAP_USER');
  const imapPass = Deno.env.get('IMAP_PASS');

  if (!supabaseUrl || !supabaseServiceKey || !imapHost || !imapUser || !imapPass) {
    const missing = [
        !supabaseUrl && 'SUPABASE_URL',
        !supabaseServiceKey && 'SUPABASE_SERVICE_ROLE_KEY',
        !imapHost && 'IMAP_HOST',
        !imapUser && 'IMAP_USER',
        !imapPass && 'IMAP_PASS'
    ].filter(Boolean).join(', ');
    throw new Error(`Missing required environment variables: ${missing}`);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log("[test-single-email-sync] Supabase client initialized.");

  const client = new ImapFlow({
    host: imapHost,
    port: 993,
    secure: true,
    auth: {
      user: imapUser,
      pass: imapPass,
    },
    logger: false
  });

  try {
    await client.connect();
    console.log('[test-single-email-sync] IMAP connected.');

    await client.mailboxOpen('INBOX');
    console.log('[test-single-email-sync] INBOX opened.');

    const { data: userAccount, error: userError } = await supabase
      .from('email_accounts')
      .select('user_id')
      .eq('imap_username', imapUser)
      .single();

    if (userError || !userAccount) {
      throw new Error(`Could not find a user profile associated with the IMAP username: ${imapUser}. Please ensure an account is set up in the application for this user. Error: ${userError?.message}`);
    }
    const userId = userAccount.user_id;

    const { data: existingEmails } = await supabase
      .from('emails')
      .select('uid')
      .eq('user_id', userId)
      .eq('mailbox', 'INBOX');

    const existingUids = new Set((existingEmails ?? []).map(e => e.uid));
    const serverUids = await client.search({ all: true });
    const newUids = serverUids.filter(uid => !existingUids.has(uid));

    if (newUids.length === 0) {
      console.log('[test-single-email-sync] Keine neuen E-Mails.');
      return 'Keine neuen E-Mails gefunden.';
    }

    console.log(`[test-single-email-sync] Neue E-Mails: ${newUids.length}`);

    const messages = client.fetch(newUids, { source: true, uid: true });
    let savedCount = 0;

    for await (const msg of messages) {
      if (!msg.source) continue;
      const source = await streamToBuffer(msg.source);
      const parsed = await simpleParser(source);

      const email = {
        user_id: userId,
        uid: msg.uid,
        mailbox: 'INBOX',
        from_address: formatAddress(parsed.from),
        to_address: formatAddress(parsed.to),
        subject: parsed.subject,
        sent_at: parsed.date?.toISOString(),
        body_text: parsed.text,
        body_html: parsed.html,
      };

      const { error } = await supabase.from('emails').insert(email);
      if (error) {
        console.error(`[test-single-email-sync] Fehler beim Speichern von UID ${msg.uid}:`, error.message);
      } else {
        console.log(`[test-single-email-sync] E-Mail UID ${msg.uid} gespeichert.`);
        savedCount++;
      }
    }
    return `IMAP-Verbindung geschlossen. ${savedCount} neue E-Mails gespeichert.`;
  } finally {
    if (client.state !== 'disconnected') {
        await client.logout();
        console.log('[test-single-email-sync] IMAP Verbindung geschlossen.');
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const resultMessage = await fetchAndStoreEmails();
    return new Response(JSON.stringify({ success: true, message: resultMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error("--- [test-single-email-sync] FUNCTION CRASHED ---", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})