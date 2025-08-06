import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import imaps from 'npm:imap-simple';
import { simpleParser } from 'npm:mailparser';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to convert Base64 to ArrayBuffer
const b64_to_ab = (b64: string) => {
  const byteString = Buffer.from(b64, "base64").toString("binary");
  const len = byteString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Helper to convert hex string to ArrayBuffer
const hex_to_ab = (hex: string) => {
  const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16)));
  return typedArray.buffer;
};

async function decrypt(encryptedData: string, iv_b64: string, key_hex: string): Promise<string> {
  const keyBuffer = hex_to_ab(key_hex);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const iv = new Uint8Array(b64_to_ab(iv_b64));
  const data = new Uint8Array(b64_to_ab(encryptedData));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requiredEnv = ['SMTP_HOST', 'APP_ENCRYPTION_KEY'];
    const missingEnv = requiredEnv.filter(v => !Deno.env.get(v));
    if (missingEnv.length > 0) {
      throw new Error(`Server-Konfigurationsfehler: Fehlende Secrets: ${missingEnv.join(', ')}`);
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

    const config = {
      imap: {
        user: creds.imap_username,
        password: decryptedPassword,
        host: Deno.env.get('SMTP_HOST')!,
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }, // DIAGNOSTIC: Temporarily disable certificate verification
        authTimeout: 5000
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
      if (!allParts) continue;
      
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
    console.error("Fetch-Emails Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})