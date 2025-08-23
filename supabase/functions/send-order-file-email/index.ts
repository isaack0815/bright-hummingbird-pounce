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
  console.log("--- [send-order-file-email] Function invoked ---");

  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error(userError?.message || "User not authenticated");
    console.log(`[send-order-file-email] Step 1: User authenticated with ID: ${user.id}`);

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
    console.log(`[send-order-file-email] Step 2: Received payload: fileId=${fileId}, recipient=${recipientEmail}`);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email_signature')
      .eq('id', user.id)
      .single();
    if (profileError && profileError.code !== 'PGRST116') throw profileError;
    console.log(`[send-order-file-email] Step 3: Fetched user profile. Signature found: ${!!profile?.email_signature}`);

    const { data: file, error: fileError } = await supabaseAdmin
      .from('order_files')
      .select('file_path, file_name, file_type')
      .eq('id', fileId)
      .single();
    if (fileError || !file) throw new Error(fileError?.message || 'File not found.');
    console.log(`[send-order-file-email] Step 4: Fetched file metadata for ID ${fileId}: ${file.file_name}`);

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('order-files')
      .download(file.file_path);
    if (downloadError) throw downloadError;
    const fileContent = await fileData.arrayBuffer();
    console.log(`[send-order-file-email] Step 5: File downloaded successfully. Size: ${fileContent.byteLength} bytes.`);

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpSecure = Deno.env.get('SMTP_SECURE');
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL');
    console.log(`[send-order-file-email] Step 6: Read SMTP secrets. Host: ${smtpHost}`);

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
    console.log(`[send-order-file-email] Step 7: Created nodemailer transporter.`);
    
    const userSignature = profile?.email_signature || '';
    const finalMessageBody = `${messageBody || '<p>Anbei erhalten Sie die angeforderte Datei.</p>'}<br/><br/>${userSignature}`;

    console.log(`[send-order-file-email] Step 8: Sending email to ${recipientEmail}...`);
    const info = await transporter.sendMail({
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
    console.log(`[send-order-file-email] Step 8.1: Nodemailer response received:`, info);

    console.log(`[send-order-file-email] Step 9: Logging 'emailed' activity.`);
    await supabaseAdmin.from('file_activity_logs').insert({
        file_id: fileId,
        user_id: user.id,
        action: 'emailed',
        details: {
            recipient: recipientEmail,
            subject: subject,
        }
    });
    console.log(`[send-order-file-email] Step 9.1: Activity logged successfully.`);

    console.log("--- [send-order-file-email] Function finished successfully ---");
    return new Response(JSON.stringify({ success: true, message: `Email with attachment sent to ${recipientEmail}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    console.error('--- [send-order-file-email] CRITICAL ERROR ---', e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});