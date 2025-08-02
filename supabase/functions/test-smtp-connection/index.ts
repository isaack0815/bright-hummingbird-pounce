import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Client } from "https://deno.land/x/denomailer@1.0.0/mod.ts";

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
    steps.push("Function started using denomailer library.");

    const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL'];
    const missingEnv = requiredEnv.filter(v => !Deno.env.get(v));
    if (missingEnv.length > 0) {
      throw new Error(`Missing required SMTP secrets: ${missingEnv.join(', ')}`);
    }
    steps.push("All required secrets are present.");

    const smtpSecure = Deno.env.get('SMTP_SECURE')?.toLowerCase();
    const useTls = smtpSecure === 'ssl' || smtpSecure === 'tls';
    steps.push(`Connection mode: ${useTls ? 'Implicit TLS (SSL)' : 'Plain/STARTTLS'}`);

    const client = new Client({
      connection: {
        hostname: Deno.env.get('SMTP_HOST')!,
        port: Number(Deno.env.get('SMTP_PORT')!),
        tls: useTls,
        auth: {
          user: Deno.env.get('SMTP_USER')!,
          pass: Deno.env.get('SMTP_PASS')!,
        },
      },
    });
    steps.push("Client configured.");

    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL')!;
    steps.push(`Attempting to send a test email to: ${fromEmail}`);

    const result = await client.send({
      from: fromEmail,
      to: fromEmail,
      subject: "SMTP Connection Test (Success)",
      html: "This is a test email to verify SMTP settings. If you received this, the connection is working.",
    });
    steps.push(`Email sent successfully. Message ID: ${result.messageId}`);

    await client.close();
    steps.push("Connection closed.");

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
      status: 200,
    })
  }
})