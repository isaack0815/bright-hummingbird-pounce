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

    const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL'];
    const missingEnv = requiredEnv.filter(v => !Deno.env.get(v));
    if (missingEnv.length > 0) {
      throw new Error(`Missing required SMTP secrets: ${missingEnv.join(', ')}`);
    }
    steps.push("All required secrets are present.");
    const host = Deno.env.get('SMTP_HOST')!;
    const port = Number(Deno.env.get('SMTP_PORT')!);
    const user = Deno.env.get('SMTP_USER')!;
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL')!;
    steps.push(`Host: ${host}, Port: ${port}, User: ${user}`);

    const client = new SmtpClient();
    steps.push("SMTP client created.");

    steps.push(`Attempting to connect to ${host}:${port}...`);
    await client.connect({
      hostname: host,
      port: port,
      username: user,
      password: Deno.env.get('SMTP_PASS')!,
    });
    steps.push("Connection to SMTP server successful.");

    steps.push(`Attempting to send a test email to: ${fromEmail}`);
    await client.send({
      from: fromEmail,
      to: fromEmail,
      subject: "SMTP Connection Test (Success)",
      html: "This is a test email to verify SMTP settings. If you received this, the connection is working.",
    });
    steps.push("Test email sent successfully.");

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
      status: 200, // Return 200 OK to ensure the browser can read the error payload
    })
  }
})