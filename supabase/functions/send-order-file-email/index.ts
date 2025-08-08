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
    // 1. Check for required SMTP secrets
    const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL'];
    const missingEnv = requiredEnv.filter(v => !Deno.env.get(v));
    if (missingEnv.length > 0) {
      throw new Error(`Server configuration error: Missing required SMTP secrets: ${missingEnv.join(', ')}`);
    }

    // 2. Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Get data from request body
    const { fileId, recipientEmail, subject, messageBody } = await req.json();
    if (!fileId || !recipientEmail || !subject) {
      return new Response(JSON.stringify({ error: 'File ID, recipient email, and subject are required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Fetch file details from the database
    const { data: file, error: fileError } = await supabaseAdmin
      .from('order_files')
      .select('file_path, file_name, file_type')
      .eq('id', fileId)
      .single();
    if (fileError || !file) throw new Error(fileError?.message || 'File not found.');

    // 5. Download the file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('order-files')
      .download(file.file_path);
    if (downloadError) throw downloadError;
    const fileContent = await fileData.arrayBuffer();

    // 6. Set up Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST')!,
      port: Number(Deno.env.get('SMTP_PORT')!),
      secure: Deno.env.get('SMTP_SECURE')?.toLowerCase() === 'ssl' || Deno.env.get('SMTP_SECURE')?.toLowerCase() === 'tls',
      auth: {
        user: Deno.env.get('SMTP_USER')!,
        pass: Deno.env.get('SMTP_PASS')!,
      },
    });

    // 7. Send the email
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') ?? 'noreply@example.com';
    
    await transporter.sendMail({
      from: fromEmail,
      to: recipientEmail,
      subject: subject,
      html: messageBody || '<p>Anbei erhalten Sie die angeforderte Datei.</p>',
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