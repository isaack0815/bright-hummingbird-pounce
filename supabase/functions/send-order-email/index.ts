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
    const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL'];
    const missingEnv = requiredEnv.filter(v => !Deno.env.get(v));
    if (missingEnv.length > 0) {
      throw new Error(`Server configuration error: Missing required SMTP secrets: ${missingEnv.join(', ')}`);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orderId } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('freight_orders')
      .select('order_number, external_email, customers(company_name)')
      .eq('id', orderId)
      .single()
    if (orderError || !order) throw new Error(orderError?.message || 'Order not found')
    if (!order.external_email) throw new Error('No external email address for this order.')

    const { data: settings, error: settingsError } = await supabaseAdmin.from('settings').select('*')
    if (settingsError) throw settingsError
    const settingsMap = new Map(settings.map(s => [s.key, s.value]))

    const { data: pdfFile, error: fileError } = await supabaseAdmin
      .from('order_files')
      .select('file_path, file_name')
      .eq('order_id', orderId)
      .eq('is_archived', false)
      .like('file_name', 'Transportauftrag_%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (fileError || !pdfFile) throw new Error(fileError?.message || 'Transport agreement PDF not found.')

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('order-files')
      .download(pdfFile.file_path)
    if (downloadError) throw downloadError
    const pdfContent = await fileData.arrayBuffer()

    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST')!,
      port: Number(Deno.env.get('SMTP_PORT')!),
      secure: Deno.env.get('SMTP_SECURE')?.toLowerCase() === 'ssl' || Deno.env.get('SMTP_SECURE')?.toLowerCase() === 'tls',
      auth: {
        user: Deno.env.get('SMTP_USER')!,
        pass: Deno.env.get('SMTP_PASS')!,
      },
    });

    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') ?? 'noreply@example.com'
    const companyName = settingsMap.get('company_name') ?? 'Your Company'
    const signature = settingsMap.get('email_signature') ?? `<p>Mit freundlichen Grüßen,<br/>${companyName}</p>`
    const bccEmail = settingsMap.get('email_bcc')

    await transporter.sendMail({
      from: `"${companyName}" <${fromEmail}>`,
      to: order.external_email,
      bcc: bccEmail || undefined,
      subject: `Transportauftrag ${order.order_number} von ${companyName}`,
      html: `
        <p>Sehr geehrte Damen und Herren,</p>
        <p>anbei erhalten Sie den Transportauftrag mit der Nummer <strong>${order.order_number}</strong> für den Kunden <strong>${(order.customers as any)?.company_name ?? ''}</strong>.</p>
        <p>Bitte bestätigen Sie den Erhalt dieser E-Mail.</p>
        <br/>
        ${signature}
      `,
      attachments: [
        {
          filename: pdfFile.file_name,
          content: new Uint8Array(pdfContent),
          contentType: 'application/pdf',
        },
      ],
    });

    return new Response(JSON.stringify({ success: true, message: `Email sent to ${order.external_email}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('Critical error in send-order-email function:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})