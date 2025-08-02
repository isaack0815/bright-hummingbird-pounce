import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { SmtpConnection } from "https://deno.land/x/denomailer@1.0.0/smtp.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const steps: string[] = [];
  try {
    steps.push("Function started.");

    // 1. Check for required environment variables
    const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL'];
    const missingEnv = requiredEnv.filter(v => !Deno.env.get(v));
    if (missingEnv.length > 0) {
      throw new Error(`Missing required SMTP secrets: ${missingEnv.join(', ')}`);
    }
    steps.push("All required secrets are present.");

    // 2. Parse port
    const port = Number(Deno.env.get('SMTP_PORT'));
    if (isNaN(port)) {
        throw new Error(`Invalid SMTP_PORT: Not a number.`);
    }
    steps.push(`Port parsed successfully: ${port}`);

    // 3. Get other config
    const smtpSecure = Deno.env.get('SMTP_SECURE')?.toLowerCase();
    const useTls = smtpSecure === 'tls' || smtpSecure === 'ssl';
    steps.push(`TLS/SSL mode: ${useTls} (based on SMTP_SECURE value: ${smtpSecure})`);

    // 4. Instantiate and connect
    const connection = new SmtpConnection({
      hostname: Deno.env.get('SMTP_HOST')!,
      port: port,
      tls: useTls,
      auth: {
        user: Deno.env.get('SMTP_USER')!,
        pass: Deno.env.get('SMTP_PASS')!,
      },
    });
    steps.push("SMTP connection object created.");

    await connection.connect();
    steps.push("Connection to SMTP server successful (connect() method resolved).");

    await connection.close();
    steps.push("Connection closed successfully.");

    return new Response(JSON.stringify({ success: true, message: "SMTP connection successful!", steps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('SMTP Connection Test Error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ success: false, error: errorMessage, steps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})