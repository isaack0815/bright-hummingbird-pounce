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

    const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL'];
    const missingEnv = requiredEnv.filter(v => !Deno.env.get(v));
    if (missingEnv.length > 0) {
      throw new Error(`Missing required SMTP secrets: ${missingEnv.join(', ')}`);
    }
    steps.push("All required secrets are present.");

    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST')!,
      port: Number(Deno.env.get('SMTP_PORT')!),
      secure: Deno.env.get('SMTP_SECURE')?.toLowerCase() === 'ssl' || Deno.env.get('SMTP_SECURE')?.toLowerCase() === 'tls',
      auth: {
        user: Deno.env.get('SMTP_USER')!,
        pass: Deno.env.get('SMTP_PASS')!,
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