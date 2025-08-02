import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/emailjs@3.0.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const steps: string[] = [];

  try {
    steps.push("Function started using emailjs@3.0.0.");

    const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL'];
    const missingEnv = requiredEnv.filter(v => !Deno.env.get(v));
    if (missingEnv.length > 0) {
      throw new Error(`Missing required SMTP secrets: ${missingEnv.join(', ')}`);
    }
    steps.push("All required secrets are present.");

    const client = new SMTPClient({
      user: Deno.env.get('SMTP_USER')!,
      password: Deno.env.get('SMTP_PASS')!,
      host: Deno.env.get('SMTP_HOST')!,
      port: Number(Deno.env.get('SMTP_PORT')!),
      ssl: Deno.env.get('SMTP_SECURE')?.toLowerCase() === 'ssl',
    });
    steps.push("Client configured.");

    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL')!;
    steps.push(`Attempting to send a test email to: ${fromEmail}`);
    
    await client.send({
      from: fromEmail,
      to: fromEmail,
      subject: "SMTP Test Email (Success)",
      text: "This is a test email to confirm SMTP configuration.",
    });

    steps.push("Email sent successfully.");

    return new Response(JSON.stringify({
      success: true,
      message: "SMTP connection successful. Test email sent.",
      steps
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    console.error("SMTP Connection Test Error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    steps.push(`ERROR: ${errorMessage}`);

    return new Response(JSON.stringify({ success: false, error: errorMessage, steps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});