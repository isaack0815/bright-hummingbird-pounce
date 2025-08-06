import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import imaps from 'npm:imap-simple';
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

const formatAddress = (addr: any): string | null => {
    if (!addr || !addr.value || addr.value.length === 0) return null;
    const { name, address } = addr.value[0];
    if (!address) return null;
    return name ? `"${name}" <${address}>` : `<${address}>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const BATCH_SIZE = 10;
    const imapHost = Deno.env.get('IMAP_HOST');
    const encryptionKey = Deno.env.get('APP_ENCRYPTION_KEY');

    if (!imapHost || !encryptionKey) throw new Error("Server configuration error.");

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

    const { data: creds } = await supabaseAdmin.from('email_accounts').select('imap_username, encrypted_imap_password, iv').eq('user_id', user.id).single();
    if (!creds) throw new Error("Email account not configured.");

    const decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, encryptionKey);

    const { data: latestEmail } = await supabaseAdmin.from('emails').select('uid').eq('user_id', user.id).order('uid', { ascending: false }).limit(1).single();
    const highestUidInDb = latestEmail?.uid || 0;

    const config = {
      imap: {
        user: creds.imap_username,
        pass: decryptedPassword,
        host: imapHost,
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: {
          rejectUnauthorized: false
        }
      }
    };

    let newEmailsCount = 0;
    let moreEmailsExist = false;
    
    const connection = await imaps.connect(config);
    try {
      await connection.openBox('INBOX');
      const searchCriteria = ['UID', `${highestUidInDb + 1}:*`];
      const allNewUids = await connection.search(searchCriteria, {});
      
      if (allNewUids.length > 0) {
        const uidsToFetch = allNewUids.slice(0, BATCH_SIZE);
        moreEmailsExist = allNewUids.length > BATCH_SIZE;

        const messages = await connection.fetch(uidsToFetch, { bodies: [''] });

        for (const item of messages) {
          const rawEmail = item.parts.find(part => part.which === '')?.body;
          if (!rawEmail) continue;

          const uid = item.attributes.uid;
          const parsed = await simpleParser(rawEmail);

          const { data: insertedEmail, error: insertEmailError } = await supabaseAdmin
            .from('emails')
            .insert({
              user_id: user.id,
              uid: uid,
              mailbox: 'INBOX',
              from_address: formatAddress(parsed.from),
              to_address: formatAddress(parsed.to),
              subject: parsed.subject || null,
              sent_at: parsed.date || null,
              body_text: parsed.text || null,
              body_html: parsed.html || null,
            })
            .select('id')
            .single();

          if (insertEmailError) throw insertEmailError;

          if (parsed.attachments && parsed.attachments.length > 0) {
            for (const attachment of parsed.attachments) {
              const filePath = `${user.id}/${uid}/${attachment.filename}`;
              
              const { error: uploadError } = await supabaseAdmin.storage
                .from('email-attachments')
                .upload(filePath, attachment.content, { contentType: attachment.contentType, upsert: true });

              if (uploadError) {
                console.error(`Failed to upload attachment: ${attachment.filename}`, uploadError);
                continue;
              }

              await supabaseAdmin.from('email_attachments').insert({
                email_id: insertedEmail.id,
                file_name: attachment.filename,
                file_path: filePath,
                file_type: attachment.contentType,
              });
            }
          }
          newEmailsCount++;
        }
      }
    } finally {
      connection.end();
    }

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