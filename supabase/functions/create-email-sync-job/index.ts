import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ImapFlow } from 'npm:imapflow';
import { Buffer } from "https://deno.land/std@0.160.0/node/buffer.ts";
globalThis.Buffer = Buffer;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decryption logic
const b64_to_ab = (b64: string) => { const byteString = Buffer.from(b64, "base64").toString("binary"); const len = byteString.length; const bytes = new Uint8Array(len); for (let i = 0; i < len; i++) { bytes[i] = byteString.charCodeAt(i); } return bytes.buffer; };
const hex_to_ab = (hex: string) => { const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16))); return typedArray.buffer; };
async function decrypt(encryptedData: string, iv_b64: string, key_hex: string): Promise<string> { const keyBuffer = hex_to_ab(key_hex); const key = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]); const iv = new Uint8Array(b64_to_ab(iv_b64)); const data = new Uint8Array(b64_to_ab(encryptedData)); const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data); return new TextDecoder().decode(decrypted); }


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    // 1. Get credentials
    const { data: creds } = await supabaseAdmin.from('email_accounts').select('imap_username, encrypted_imap_password, iv').eq('user_id', user.id).single();
    if (!creds) throw new Error("Email account not configured.");
    const decryptedPassword = await decrypt(creds.encrypted_imap_password, creds.iv, Deno.env.get('APP_ENCRYPTION_KEY')!);

    // 2. Get latest UID from DB
    const { data: latestEmail } = await supabaseAdmin.from('emails').select('uid').eq('user_id', user.id).order('uid', { ascending: false }).limit(1).single();
    const highestUidInDb = latestEmail?.uid || 0;

    // 3. Connect to IMAP and get list of new UIDs using ImapFlow
    const client = new ImapFlow({
        host: Deno.env.get('IMAP_HOST')!,
        port: 993,
        secure: true,
        auth: { user: creds.imap_username, pass: decryptedPassword },
        tls: { rejectUnauthorized: false },
        logger: false
    });

    let allNewUids: number[] = [];
    await client.connect();
    try {
        await client.mailboxOpen('INBOX');
        // Use client.search which directly returns an array of numbers (UIDs).
        // This is the most direct and correct way.
        allNewUids = await client.search({ uid: `${highestUidInDb + 1}:*` });
    } finally {
        await client.logout();
    }

    if (allNewUids.length === 0) {
        return new Response(JSON.stringify({ message: "No new emails." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Create a new job in the database
    const { data: job, error: jobError } = await supabaseAdmin
      .from('email_sync_jobs')
      .insert({
        user_id: user.id,
        status: 'processing',
        uids_to_process: allNewUids,
        total_count: allNewUids.length,
        processed_count: 0,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    return new Response(JSON.stringify(job), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})