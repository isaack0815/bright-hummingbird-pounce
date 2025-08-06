import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";
import { ImapFlow } from 'npm:imapflow';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to convert ArrayBuffer to Base64
const ab_to_b64 = (ab: ArrayBuffer) => Buffer.from(ab).toString("base64");

// Helper to convert hex string to ArrayBuffer
const hex_to_ab = (hex: string) => {
  const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16)));
  return typedArray.buffer;
};

async function encrypt(data: string, key_hex: string): Promise<{ encrypted: string, iv: string }> {
  const keyBuffer = hex_to_ab(key_hex);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encodedData
  );

  return {
    encrypted: ab_to_b64(encrypted),
    iv: ab_to_b64(iv),
  };
}

serve(async (req) => {
  console.log("--- [save-email-account] Function invoked ---");
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Permission check
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;
    
    const permissionNames = permissions.map((p: any) => p.permission_name);
    const isSuperAdmin = permissionNames.includes('roles.manage') && permissionNames.includes('users.manage');
    const hasPermission = permissionNames.includes('personnel_files.manage');

    if (!isSuperAdmin && !hasPermission) {
      console.error("[save-email-account] Error: Permission denied.");
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
    console.log("[save-email-account] Step 1: Permission check passed.");

    const { userId, email_address, imap_username, imap_password } = await req.json()
    console.log(`[save-email-account] Step 2: Received data for user ID: ${userId}`);
    if (!userId || !email_address || !imap_username || !imap_password) {
      console.error("[save-email-account] Error: Missing required fields in request body.");
      return new Response(JSON.stringify({ error: 'Alle Felder sind erforderlich' }), { status: 400 })
    }

    const imapHost = Deno.env.get('IMAP_HOST');
    if (!imapHost) {
        console.error("[save-email-account] CRITICAL ERROR: IMAP_HOST secret is not set in environment.");
        throw new Error("Server-Konfigurationsfehler: Das Secret 'IMAP_HOST' ist nicht gesetzt.");
    }
    console.log(`[save-email-account] Step 3: IMAP_HOST found: ${imapHost}`);

    // --- Verbindungstest mit imapflow ---
    console.log("[save-email-account] Step 4: Starting IMAP connection test...");
    const client = new ImapFlow({
        host: imapHost,
        port: 993,
        secure: true,
        auth: {
            user: imap_username,
            pass: imap_password,
        },
        tls: {
            rejectUnauthorized: false
        },
        logger: false
    });

    try {
        await client.connect();
        console.log("[save-email-account] Step 4.1: IMAP connection successful.");
        await client.logout();
        console.log("[save-email-account] Step 4.2: IMAP logout successful.");
    } catch (e) {
        console.error("[save-email-account] CRITICAL ERROR: IMAP Connection Test Failed.", e);
        return new Response(JSON.stringify({ error: `Verbindung zum IMAP-Server fehlgeschlagen. Prüfen Sie den IMAP_HOST in den Secrets und Ihre Zugangsdaten. Fehler: ${e.message}` }), { status: 400 });
    }
    // --- Ende Verbindungstest ---

    const encryptionKey = Deno.env.get('APP_ENCRYPTION_KEY');
    if (!encryptionKey || encryptionKey.length !== 64) {
        console.error("[save-email-account] CRITICAL ERROR: APP_ENCRYPTION_KEY secret is not set or invalid.");
        throw new Error("APP_ENCRYPTION_KEY secret is not set or is not a 64-character hex string (32 bytes).");
    }
    console.log("[save-email-account] Step 5: Encryption key found.");

    const { encrypted, iv } = await encrypt(imap_password, encryptionKey);
    console.log("[save-email-account] Step 6: Password encrypted successfully.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("[save-email-account] Step 7: Upserting data into 'email_accounts' table...");
    const { error } = await supabaseAdmin
      .from('email_accounts')
      .upsert({
        user_id: userId,
        email_address: email_address,
        imap_username: imap_username,
        encrypted_imap_password: encrypted,
        iv: iv,
      }, { onConflict: 'user_id' });

    if (error) {
        console.error("[save-email-account] CRITICAL ERROR: Database upsert failed.", error);
        throw error;
    }
    console.log("[save-email-account] Step 8: Database upsert successful.");

    console.log("--- [save-email-account] Function finished successfully ---");
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error("--- [save-email-account] FUNCTION CRASHED ---", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})