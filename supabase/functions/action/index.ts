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
    const { action, payload } = await req.json();
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("User not authenticated");

    const checkPermission = async (permission: string) => {
        const { data: permissions, error } = await supabase.rpc('get_my_permissions');
        if (error) throw error;
        const permissionNames = permissions.map((p: any) => p.permission_name);
        const isSuperAdmin = permissionNames.includes('roles.manage') && permissionNames.includes('users.manage');
        return isSuperAdmin || permissionNames.includes(permission);
    }

    switch (action) {
      // ... existing cases
      case 'login': {
        const { username, password } = payload;
        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Benutzername und Passwort sind erforderlich' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

        if (userError || !authUser || !authUser.email) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const { data: sessionData, error: signInError } = await createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        ).auth.signInWithPassword({
            email: authUser.email,
            password: password,
        });

        if (signInError) {
            return new Response(JSON.stringify({ error: 'Ungültige Anmeldedaten' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ session: sessionData.session }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'get-vehicle-file-categories': {
        if (!await checkPermission('vehicles.manage')) throw new Error('Forbidden');
        const { data, error } = await supabaseAdmin.from('vehicle_file_categories').select('*').order('name');
        if (error) throw error;
        return new Response(JSON.stringify({ categories: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'create-vehicle-file-category': {
        if (!await checkPermission('vehicles.manage')) throw new Error('Forbidden');
        const { name } = payload;
        if (!name) return new Response(JSON.stringify({ error: 'Category name is required' }), { status: 400 });
        const { data, error } = await supabaseAdmin.from('vehicle_file_categories').insert({ name }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ category: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }

      case 'get-vehicle-files': {
        if (!await checkPermission('vehicles.manage')) throw new Error('Forbidden');
        const { vehicleId } = payload;
        if (!vehicleId) return new Response(JSON.stringify({ error: 'Vehicle ID is required' }), { status: 400 });
        const { data, error } = await supabaseAdmin.from('vehicle_files_with_details').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ files: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'delete-vehicle-file': {
        if (!await checkPermission('vehicles.manage')) throw new Error('Forbidden');
        const { fileId } = payload;
        if (!fileId) return new Response(JSON.stringify({ error: 'File ID is required' }), { status: 400 });
        
        const { data: file, error: fetchError } = await supabaseAdmin.from('vehicle_files').select('file_path').eq('id', fileId).single();
        if (fetchError) throw fetchError;

        const { error: storageError } = await supabaseAdmin.storage.from('vehicle-files').remove([file.file_path]);
        if (storageError) throw storageError;

        const { error: dbError } = await supabaseAdmin.from('vehicle_files').delete().eq('id', fileId);
        if (dbError) throw dbError;

        return new Response(null, { status: 204, headers: corsHeaders });
      }

      case 'get-all-vehicle-files': {
        if (!await checkPermission('files.manage')) throw new Error('Forbidden');
        const { data, error } = await supabaseAdmin.from('vehicle_files_with_details').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ files: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'get-all-vehicles-for-select': {
        const { data, error } = await supabaseAdmin.from('vehicles').select('id, license_plate').order('license_plate', { ascending: true });
        if (error) throw error;
        return new Response(JSON.stringify({ vehicles: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'get-vehicle-file-download-url': {
        if (!user) throw new Error("User not authenticated");
        const { filePath } = payload;
        if (!filePath) return new Response(JSON.stringify({ error: 'filePath is required' }), { status: 400 });
        const { data, error } = await supabaseAdmin.storage.from('vehicle-files').createSignedUrl(filePath, 60);
        if (error) throw error;
        return new Response(JSON.stringify({ signedUrl: data.signedUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // New cases for personal file manager
      case 'get-user-files-and-folders': {
        const { data: folders, error: foldersError } = await supabase.from('user_folders').select('*').eq('user_id', user.id).order('name');
        if (foldersError) throw foldersError;
        
        const { data: ownedFiles, error: ownedFilesError } = await supabase.from('user_files').select('*').eq('user_id', user.id).order('file_name');
        if (ownedFilesError) throw ownedFilesError;

        const { data: sharedFiles, error: sharedFilesError } = await supabase
          .from('file_shares')
          .select('user_files(*, profiles!user_id(first_name, last_name))')
          .eq('shared_with_user_id', user.id);
        if (sharedFilesError) throw sharedFilesError;

        return new Response(JSON.stringify({ folders, ownedFiles, sharedFiles: sharedFiles.map(s => s.user_files) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'create-user-folder': {
        const { name, parent_folder_id } = payload;
        if (!name) return new Response(JSON.stringify({ error: 'Folder name is required' }), { status: 400 });
        const { data, error } = await supabase.from('user_folders').insert({ name, parent_folder_id, user_id: user.id }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ folder: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }

      case 'delete-user-file': {
        const { fileId } = payload;
        if (!fileId) return new Response(JSON.stringify({ error: 'File ID is required' }), { status: 400 });
        const { data: file, error: fetchError } = await supabase.from('user_files').select('file_path').eq('id', fileId).single();
        if (fetchError) throw fetchError;
        await supabase.storage.from('user-files').remove([file.file_path]);
        await supabase.from('user_files').delete().eq('id', fileId);
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      case 'delete-user-folder': {
        const { folderId } = payload;
        if (!folderId) return new Response(JSON.stringify({ error: 'Folder ID is required' }), { status: 400 });
        // Note: Assumes folder is empty of files and subfolders (enforced on client)
        const { error } = await supabase.from('user_folders').delete().eq('id', folderId);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      case 'get-user-file-download-url': {
        const { filePath } = payload;
        if (!filePath) return new Response(JSON.stringify({ error: 'filePath is required' }), { status: 400 });
        const { data, error } = await supabase.storage.from('user-files').createSignedUrl(filePath, 60);
        if (error) throw error;
        return new Response(JSON.stringify({ signedUrl: data.signedUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'get-file-shares': {
        const { fileId } = payload;
        if (!fileId) return new Response(JSON.stringify({ error: 'File ID is required' }), { status: 400 });
        const { data, error } = await supabase.from('file_shares').select('shared_with_user_id, profiles:shared_with_user_id(first_name, last_name)').eq('file_id', fileId);
        if (error) throw error;
        return new Response(JSON.stringify({ shares: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'share-file': {
        const { fileId, userIdToShareWith } = payload;
        if (!fileId || !userIdToShareWith) return new Response(JSON.stringify({ error: 'File ID and User ID are required' }), { status: 400 });
        const { error } = await supabase.from('file_shares').insert({ file_id: fileId, shared_by_user_id: user.id, shared_with_user_id: userIdToShareWith });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }

      case 'unshare-file': {
        const { fileId, userIdToUnshare } = payload;
        if (!fileId || !userIdToUnshare) return new Response(JSON.stringify({ error: 'File ID and User ID are required' }), { status: 400 });
        const { error } = await supabase.from('file_shares').delete().match({ file_id: fileId, shared_with_user_id: userIdToUnshare });
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})