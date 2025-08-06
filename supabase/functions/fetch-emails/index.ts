import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow';
import { simpleParser } from 'npm:mailparser';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decryption helpers
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
  console.log("--- [fetch-emails] Function invoked ---");
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const imapHost = Deno.env.get('IMAP_HOST');
    const encryptionKey = Deno.env.get('APP_ENCRYPTION_KEY');

    if (!imapHost) {
      console.error("[fetch-emails] CRITICAL ERROR: IMAP_HOST secret is not set.");
      throw new Error("Server-Konfigurationsfehler: Das Secret 'IMAP_HOST' ist nicht gesetzt.");
    }
    if (!encryptionKey || encryptionKey.length !== 64) {
      console.error("[fetch-emails] CRITICAL ERROR: APP_ENCRYPTION_KEY secret is not set or invalid.");
      throw new Error("APP_ENCRYPTION_KEY secret is not set or is not a 64-character hex string (32 bytes).");
    }
    console.log(`[fetch-emails] Step 1: Secrets found (IMAP_HOST: ${imapHost}).`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("User not found")
    console.log(`[fetch-emails] Step 2: User authenticated with ID: ${user.id}`);

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
      console.error("[fetch-emails] Error fetching credentials for user.", credsError);
      throw new Error("E-Mail-Konto nicht konfiguriert oder Abruffehler.");
    }
    console.log(`[fetch-emails] Step 3: Found IMAP credentials for user: ${creds.imap_username}`);

    let decryptedPassword;
    try {
        decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, encryptionKey);
        console.log("[fetch-emails] Step 4: Password decrypted successfully.");
    } catch (decryptionError) {
        console.error("[fetch-emails] DECRYPTION FAILED:", decryptionError);
        throw new Error("Could not decrypt password. The encryption key may have changed or the data is corrupt.");
    }

    const { data: latestEmail, error: latestEmailError } = await supabaseAdmin
      .from('emails')
      .select('uid')
      .eq('user_id', user.id)
      .order('uid', { ascending: false })
      .limit(1)
      .single();
    if (latestEmailError && latestEmailError.code !== 'PGRST116') throw latestEmailError;
    const sinceUid = latestEmail?.uid;
    console.log(`[fetch-emails] Step 5: Latest UID in DB is: ${sinceUid}`);

    const client = new ImapFlow({
        host: imapHost,
        port: 993,
        secure: true,
        auth: { user: creds.imap_username, pass: decryptedPassword },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    const emailsToInsert = [];
    console.log("[fetch-emails] Step 6: Connecting to IMAP server...");
    await client.connect();
    console.log("[fetch-emails] Step 7: IMAP connection successful.");
    try {
        await client.mailboxOpen('INBOX');
        console.log("[fetch-emails] Step 8: INBOX opened.");
        
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        
        const fetchCriteria = sinceUid ? { uid: `${sinceUid + 1}:*` } : { since: twoDaysAgo };
        console.log(`[fetch-emails] Step 9: Fetching emails with criteria: ${JSON.stringify(fetchCriteria)}`);
        
        console.log("[fetch-emails] Step 9.1: Entering fetch loop...");
        for await (const msg of client.fetch(fetchCriteria, { source: true })) {
            console.log(`  - Processing message with UID: ${msg.uid}`);
            const mail = await simpleParser(msg.source);
            emailsToInsert.push({
                user_id: user.id,
                uid: msg.uid,
                mailbox: 'INBOX',
                from_address: mail.from?.text || null,
                to_address: mail.to?.text || null,
                subject: mail.subject || null,
                sent_at: mail.date || null,
                body_text: mail.text || null,
                body_html: mail.html || null,
            });
        }
        console.log(`[fetch-emails] Step 10: Finished fetch loop. Found ${emailsToInsert.length} new emails to insert.`);
    } finally {
        await client.logout();
        console.log("[fetch-emails] Step 12: IMAP client logged out.");
    }

    if (emailsToInsert.length > 0) {
        console.log("[fetch-emails] Step 11: Inserting new emails into database...");
        const { error: insertError } = await supabaseAdmin.from('emails').insert(emailsToInsert);
        if (insertError) {
            console.error("[fetch-emails] DATABASE INSERT FAILED:", insertError);
            throw insertError;
        }
        console.log("[fetch-emails] Step 11.1: Insert successful.");
    }

    console.log("--- [fetch-emails] Function finished successfully ---");
    return new Response(JSON.stringify({ newEmails: emailsToInsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error("--- [fetch-emails] FUNCTION CRASHED ---", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})