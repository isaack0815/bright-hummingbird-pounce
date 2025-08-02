import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

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
    steps.push("Function started using deno-smtp library.");

    // 1. Check for required environment variables
    const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL'];
    const missingEnv = requiredEnv.filter(v => !Deno.env.get(v));
    if (missingEnv.length > 0) {
      throw new Error(`Missing required SMTP secrets: ${missingEnv.join(', ')}`);
    }
    steps.push("All required secrets are present.");

    // 2. Create SMTP client
    const smtpSecure = Deno.env.get('SMTP_SECURE')?.toLowerCase();
    const useTls = smtpSecure === 'tls' || smtpSecure === 'ssl';
    
    const client = new SmtpClient();
    steps.push("SMTP client created.");

    // 3. Connect to server
    await client.connect({
      hostname: Deno.env.get('SMTP_HOST')!,
      port: Number(Deno.env.get('SMTP_PORT')!),
      username: Deno.env.get('SMTP_USER')!,
      password: Deno.env.get('SMTP_PASS')!,
    });
    steps.push("Connection to SMTP server successful.");

    // 4. Send a test email
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL')!;
    steps.push(`Attempting to send a test email to: ${fromEmail}`);

    await client.send({
      from: fromEmail,
      to: fromEmail,
      subject: "SMTP Connection Test (Success)",
      html: "This is a test email to verify SMTP settings. If you received this, the connection is working.",
    });
    steps.push("Test email sent successfully.");

    // 5. Close connection
    await client.close();
    steps.push("Connection closed successfully.");

    return new Response(JSON.stringify({ success: true, message: "SMTP connection successful! A test email was sent.", steps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('SMTP Connection Test Error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    steps.push(`ERROR: ${errorMessage}`);
    return new Response(JSON.stringify({ success: false, error: errorMessage, steps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})