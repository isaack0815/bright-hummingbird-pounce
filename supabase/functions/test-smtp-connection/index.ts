import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer";

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
    steps.push("Function started using nodemailer.");

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpSecure = Deno.env.get('SMTP_SECURE');
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL');

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromEmail) {
        throw new Error(`Server configuration error: Missing one or more required SMTP secrets. Please check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL in your Supabase project settings.`);
    }
    steps.push("All required secrets are present.");

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: smtpSecure?.toLowerCase() === 'ssl' || smtpSecure?.toLowerCase() === 'tls',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    steps.push("Nodemailer transporter created.");

    steps.push("Verifying SMTP connection...");
    await transporter.verify();
    steps.push("SMTP connection verified successfully.");

    return new Response(JSON.stringify({
      success: true,
      message: "SMTP connection successful! The server is ready to send emails.",
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