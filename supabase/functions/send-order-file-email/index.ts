import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error(userError?.message || "User not authenticated");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { fileId, recipientEmail, subject, messageBody } = await req.json();
    if (!fileId || !recipientEmail || !subject) {
      return new Response(JSON.stringify({ error: 'File ID, recipient email, and subject are required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email_signature')
      .eq('id', user.id)
      .single();
    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    const { data: file, error: fileError } = await supabaseAdmin
      .from('order_files')
      .select('file_path, file_name, file_type')
      .eq('id', fileId)
      .single();
    if (fileError || !file) throw new Error(fileError?.message || 'File not found.');

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('order-files')
      .download(file.file_path);
    if (downloadError) throw downloadError;
    const fileContent = await fileData.arrayBuffer();

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpSecure = Deno.env.get('SMTP_SECURE');
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL');

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromEmail) {
        throw new Error(`Server configuration error: Missing one or more required SMTP secrets.`);
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: smtpSecure?.toLowerCase() === 'ssl' || smtpSecure?.toLowerCase() === 'tls',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    
    const userSignature = profile?.email_signature || '';
    const finalMessageBody = `${messageBody || '<p>Anbei erhalten Sie die angeforderte Datei.</p>'}<br/><br/>${userSignature}`;

    await transporter.sendMail({
      from: fromEmail,
      to: recipientEmail,
      subject: subject,
      html: finalMessageBody,
      attachments: [
        {
          filename: file.file_name,
          content: new Uint8Array(fileContent),
          contentType: file.file_type || 'application/octet-stream',
        },
      ],
    });

    return new Response(JSON.stringify({ success: true, message: `Email with attachment sent to ${recipientEmail}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    console.error('Error in send-order-file-email function:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});