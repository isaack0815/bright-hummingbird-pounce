import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow';
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

const formatAddress = (addr: { name?: string, mailbox?: string, host?: string } | undefined): string | null => {
    if (!addr || !addr.mailbox || !addr.host) return null;
    const name = addr.name ? `"${addr.name}" ` : '';
    return `${name}<${addr.mailbox}@${addr.host}>`;
}

serve(async (req) => {
  console.log("--- [fetch-emails] Function invoked ---");
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const BATCH_SIZE = 5; // Reduced batch size for testing
    const imapHost = Deno.env.get('IMAP_HOST');
    const encryptionKey = Deno.env.get('APP_ENCRYPTION_KEY');

    if (!imapHost || !encryptionKey || encryptionKey.length !== 64) {
      throw new Error("Server-Konfigurationsfehler: Wichtige Secrets fehlen oder sind ungültig.");
    }
    console.log(`[fetch-emails] Step 1: Secrets found.`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("User not found")
    console.log(`[fetch-emails] Step 2: User authenticated.`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: creds, error: credsError } = await supabaseAdmin
      .from('email_accounts')
      .select('imap_username, encrypted_imap_password, iv')
      .eq('user_id', user.id)
      .single();
      
    if (credsError || !creds) throw new Error("E-Mail-Konto nicht konfiguriert.");
    console.log(`[fetch-emails] Step 3: Found IMAP credentials.`);

    const decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, encryptionKey);
    console.log("[fetch-emails] Step 4: Password decrypted.");

    const { data: latestEmail } = await supabaseAdmin
      .from('emails')
      .select('uid')
      .eq('user_id', user.id)
      .order('uid', { ascending: false })
      .limit(1)
      .single();
    const sinceUid = latestEmail?.uid || 0;
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
    let highestUidOnServer = 0;
    let newEmailsCount = 0;

    console.log("[fetch-emails] Step 6: Connecting to IMAP server...");
    await client.connect();
    console.log("[fetch-emails] Step 7: IMAP connection successful.");
    try {
        await client.mailboxOpen('INBOX');
        console.log("[fetch-emails] Step 8: INBOX opened.");
        
        const latestMessage = await client.fetchOne('*', { uid: true });
        highestUidOnServer = latestMessage?.uid || 0;
        console.log(`[fetch-emails] Step 9: Highest UID on server is ${highestUidOnServer}`);

        if (highestUidOnServer > sinceUid) {
            const startUid = sinceUid + 1;
            const endUid = Math.min(startUid + BATCH_SIZE - 1, highestUidOnServer);
            const fetchCriteria = { uid: `${startUid}:${endUid}` };
            
            // New fetch options: only get envelope (headers) and text body
            const fetchOptions = { 
                envelope: true, 
                body: ['TEXT']
            };
            console.log(`[fetch-emails] Step 10: Fetching batch with criteria: ${JSON.stringify(fetchCriteria)} and options: ${JSON.stringify(fetchOptions)}`);

            for await (const msg of client.fetch(fetchCriteria, fetchOptions)) {
                const envelope = msg.envelope;
                const bodyText = msg.body.get('TEXT')?.toString();

                emailsToInsert.push({
                    user_id: user.id, 
                    uid: msg.uid, 
                    mailbox: 'INBOX',
                    from_address: formatAddress(envelope.from?.[0]),
                    to_address: formatAddress(envelope.to?.[0]),
                    subject: envelope.subject || null, 
                    sent_at: envelope.date || null,
                    body_text: bodyText || null, 
                    body_html: null, // Explicitly set to null as we are not fetching it
                });
            }
            console.log(`[fetch-emails] Step 11: Finished fetch loop. Found ${emailsToInsert.length} new emails.`);
        } else {
            console.log("[fetch-emails] Step 10: No new emails found on server.");
        }
    } finally {
        await client.logout();
        console.log("[fetch-emails] Step 13: IMAP client logged out.");
    }

    if (emailsToInsert.length > 0) {
        console.log("[fetch-emails] Step 12: Inserting new emails into database...");
        const { error: insertError } = await supabaseAdmin.from('emails').insert(emailsToInsert);
        if (insertError) throw insertError;
        newEmailsCount = emailsToInsert.length;
        console.log("[fetch-emails] Step 12.1: Insert successful.");
    }

    const finalLatestUid = sinceUid + newEmailsCount;
    const moreEmailsExist = finalLatestUid < highestUidOnServer;

    console.log("--- [fetch-emails] Function finished successfully ---");
    return new Response(JSON.stringify({ newEmails: newEmailsCount, moreEmailsExist }), {
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