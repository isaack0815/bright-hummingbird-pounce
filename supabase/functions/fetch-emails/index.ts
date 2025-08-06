import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow';
import { simpleParser } from 'npm:mailparser';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decryption helpers (unchanged)
const b64_to_ab = (b64: string) => {
  const byteString = Buffer.from(b64, "base64").toString("binary");
  const len = byteString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return bytes.buffer;
};
const hex_to_ab = (hex: string) => {
  const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16)));
  return typedArray.buffer;
};
async function decrypt(encryptedData: string, iv_b64: string, key_hex: string): Promise<string> {
  const keyBuffer = hex_to_ab(key_hex);
  const key = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
  const iv = new Uint8Array(b64_to_ab(iv_b64));
  const data = new Uint8Array(b64_to_ab(encryptedData));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requiredEnv = ['SMTP_HOST', 'APP_ENCRYPTION_KEY'];
    if (requiredEnv.some(v => !Deno.env.get(v))) {
      throw new Error(`Server-Konfigurationsfehler: Fehlende Secrets.`);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("User not found")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: creds, error: credsError } = await supabaseAdmin
      .from('email_accounts')
      .select('imap_username, encrypted_imap_password, iv')
      .eq('user_id', user.id)
      .single();
      
    if (credsError || !creds) {
      throw new Error("E-Mail-Konto nicht konfiguriert oder Abruffehler.");
    }

    const encryptionKey = Deno.env.get('APP_ENCRYPTION_KEY')!;
    const decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, encryptionKey);

    // Get the latest UID from our database
    const { data: latestEmail, error: latestEmailError } = await supabaseAdmin
      .from('emails')
      .select('uid')
      .eq('user_id', user.id)
      .order('uid', { ascending: false })
      .limit(1)
      .single();
    if (latestEmailError && latestEmailError.code !== 'PGRST116') throw latestEmailError;
    const sinceUid = latestEmail?.uid;

    const client = new ImapFlow({
        host: Deno.env.get('SMTP_HOST')!,
        port: 993,
        secure: true,
        auth: { user: creds.imap_username, pass: decryptedPassword },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    const emailsToInsert = [];
    await client.connect();
    try {
        await client.mailboxOpen('INBOX');
        const fetchCriteria = sinceUid ? { uid: `${sinceUid + 1}:*` } : { all: true };
        for await (const msg of client.fetch(fetchCriteria, { source: true })) {
            const mail = await simpleParser(msg.source);
            emailsToInsert.push({
                user_id: user.id,
                uid: msg.uid,
                mailbox: 'INBOX',
                from_address: mail.from?.text,
                to_address: mail.to?.text,
                subject: mail.subject,
                sent_at: mail.date,
                body_text: mail.text,
                body_html: mail.html || null,
            });
        }
    } finally {
        await client.logout();
    }

    if (emailsToInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin.from('emails').insert(emailsToInsert);
        if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ newEmails: emailsToInsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error("Fetch-Emails Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})