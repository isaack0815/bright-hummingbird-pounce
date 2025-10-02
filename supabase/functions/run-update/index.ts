import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Permission check
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: permissions, error: permError } = await userClient.rpc('get_my_permissions');
    if (permError) throw permError;
    
    const permissionNames = permissions.map((p: any) => p.permission_name);
    const isSuperAdmin = permissionNames.includes('roles.manage') && permissionNames.includes('users.manage');
    const hasPermission = permissionNames.includes('settings.manage');

    if (!isSuperAdmin && !hasPermission) {
      return new Response("Forbidden", { status: 403 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const command = new Deno.Command("sh", {
          args: ["./update.sh"],
          stdout: "piped",
          stderr: "piped",
        });

        const child = command.spawn();
        
        const write = (chunk: string) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        
        write("Update-Prozess gestartet...\n");

        const readStream = async (stream: ReadableStream<Uint8Array>) => {
          const reader = stream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            write(new TextDecoder().decode(value));
          }
        };

        await Promise.all([
          readStream(child.stdout),
          readStream(child.stderr),
        ]);

        const status = await child.status;
        write(`\nProzess beendet mit Code: ${status.code}\n`);
        if (status.success) {
          write("---SUCCESS---");
        } else {
          write("---ERROR---");
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})