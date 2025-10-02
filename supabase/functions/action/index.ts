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
      case 'get-user-vehicle-assignment': {
        const { data, error } = await supabase
          .from('vehicles')
          .select('id, license_plate')
          .eq('driver_id', user.id)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        return new Response(JSON.stringify({ vehicle: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      case 'get-planned-tour-for-vehicle': {
        const { vehicleId } = payload;
        if (!vehicleId) return new Response(JSON.stringify({ error: 'Vehicle ID is required' }), { status: 400 });
        const { data, error } = await supabaseAdmin
          .from('freight_orders')
          .select('*, freight_order_stops(*)')
          .eq('vehicle_id', vehicleId)
          .in('status', ['Angelegt', 'Geplant', 'Unterwegs'])
          .order('pickup_date', { ascending: true });
        if (error) throw error;
        return new Response(JSON.stringify({ tour: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'get-follow-up-freight': {
        const { currentOrderId } = payload;
        if (!currentOrderId) return new Response(JSON.stringify({ error: 'Current Order ID is required' }), { status: 400 });

        const { data: currentOrder, error: currentOrderError } = await supabaseAdmin
          .from('freight_orders')
          .select('destination_address, delivery_date, vehicle_id')
          .eq('id', currentOrderId)
          .single();
        if (currentOrderError) throw currentOrderError;

        const { data: vehicle, error: vehicleError } = await supabaseAdmin
          .from('vehicles')
          .select('max_payload_kg')
          .eq('id', currentOrder.vehicle_id)
          .single();
        if (vehicleError) throw vehicleError;

        const { data: potentialOrders, error: ordersError } = await supabaseAdmin
          .from('freight_orders')
          .select('*, freight_order_stops(*), cargo_items(weight)')
          .eq('status', 'Angelegt')
          .is('vehicle_id', null);
        if (ordersError) throw ordersError;

        const followUpOrders = [];
        for (const order of potentialOrders) {
          const totalWeight = order.cargo_items.reduce((sum: number, item: any) => sum + (item.weight || 0), 0);
          const isOverweight = vehicle.max_payload_kg ? totalWeight > vehicle.max_payload_kg : false;
          
          // Simplified logic without geocoding for now to ensure performance
          followUpOrders.push({
            ...order,
            is_overweight: isOverweight,
            travel_duration_hours: 'N/A', // Placeholder
          });
        }

        return new Response(JSON.stringify({ followUpOrders }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'assign-vehicle-to-orders': {
        const { vehicleId, orderIds } = payload;
        if (!vehicleId || !orderIds) return new Response(JSON.stringify({ error: 'Vehicle ID and Order IDs are required' }), { status: 400 });
        
        // Unassign from old orders
        await supabaseAdmin
          .from('freight_orders')
          .update({ vehicle_id: null })
          .eq('vehicle_id', vehicleId)
          .not('id', 'in', `(${orderIds.join(',')})`);

        // Assign to new tour
        const { error } = await supabaseAdmin
          .from('freight_orders')
          .update({ vehicle_id: vehicleId })
          .in('id', orderIds);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

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

      case 'get-user-files-and-folders': {
        const { data: folders, error: foldersError } = await supabase.from('user_folders').select('*').eq('user_id', user.id).order('name');
        if (foldersError) throw foldersError;
        
        const { data: ownedFiles, error: ownedFilesError } = await supabase.from('user_files').select('*').eq('user_id', user.id).order('file_name');
        if (ownedFilesError) throw ownedFilesError;

        const { data: shares, error: sharesError } = await supabase.from('file_shares').select('file_id').eq('shared_with_user_id', user.id);
        if (sharesError) throw sharesError;

        let finalSharedFiles = [];
        if (shares && shares.length > 0) {
            const sharedFileIds = shares.map(s => s.file_id);
            const { data: sharedFileDetails, error: sharedFileDetailsError } = await supabase.from('user_files').select('*').in('id', sharedFileIds);
            if (sharedFileDetailsError) throw sharedFileDetailsError;

            if (sharedFileDetails && sharedFileDetails.length > 0) {
                const ownerIds = [...new Set(sharedFileDetails.map(f => f.user_id))];
                const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, first_name, last_name').in('id', ownerIds);
                if (profilesError) throw profilesError;

                const profilesMap = new Map(profiles.map(p => [p.id, p]));
                finalSharedFiles = sharedFileDetails.map(file => ({ ...file, profiles: profilesMap.get(file.user_id) || null }));
            }
        }

        return new Response(JSON.stringify({ folders, ownedFiles, sharedFiles: finalSharedFiles }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
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
        
        const { data: shares, error: sharesError } = await supabase
          .from('file_shares')
          .select('shared_with_user_id')
          .eq('file_id', fileId);
        if (sharesError) throw sharesError;
        if (!shares || shares.length === 0) {
            return new Response(JSON.stringify({ shares: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        const userIds = shares.map(s => s.shared_with_user_id);

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);
        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles.map(p => [p.id, p]));
        const combinedShares = shares.map(share => ({
            ...share,
            profiles: profilesMap.get(share.shared_with_user_id) || null
        }));

        return new Response(JSON.stringify({ shares: combinedShares }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
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

      case 'get-work-time-status': {
        const { data, error } = await supabase
          .from('work_sessions')
          .select('id, start_time')
          .eq('user_id', user.id)
          .is('end_time', null)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        return new Response(JSON.stringify({ status: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'clock-in': {
        const { data: existing, error: existingError } = await supabase
          .from('work_sessions')
          .select('id')
          .eq('user_id', user.id)
          .is('end_time', null)
          .single();
        if (existingError && existingError.code !== 'PGRST116') throw existingError;
        if (existing) {
          return new Response(JSON.stringify({ error: 'User is already clocked in.' }), { status: 409, headers: corsHeaders });
        }
        const { data, error } = await supabase
          .from('work_sessions')
          .insert({ 
            user_id: user.id, 
            start_time: new Date().toISOString(),
            start_km: payload?.start_km || null,
          })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }

      case 'clock-out': {
        const { data: activeSession, error: fetchError } = await supabase
          .from('work_sessions')
          .select('id')
          .eq('user_id', user.id)
          .is('end_time', null)
          .single();
        if (fetchError || !activeSession) {
          return new Response(JSON.stringify({ error: 'No active session found to clock out.' }), { status: 404, headers: corsHeaders });
        }
        const { data, error } = await supabase
          .from('work_sessions')
          .update({ 
            end_time: new Date().toISOString(),
            end_km: payload?.end_km || null,
            notes: payload?.notes || null,
          })
          .eq('id', activeSession.id)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'get-work-time-history': {
        const { userId, startDate, endDate } = payload;
        const targetUserId = userId || user.id;
        const { data, error } = await supabase
          .from('work_sessions')
          .select('*')
          .eq('user_id', targetUserId)
          .gte('start_time', startDate)
          .lte('start_time', endDate)
          .order('start_time', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ history: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'get-user-work-details': {
        const { userId } = payload;
        const targetUserId = userId || user.id;
        const { data, error } = await supabase
          .from('work_hours_history')
          .select('hours_per_week')
          .eq('user_id', targetUserId)
          .order('effective_date', { ascending: false })
          .limit(1)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        return new Response(JSON.stringify({ details: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'update-work-time': {
        const { id, ...updateData } = payload;
        if (!id) return new Response(JSON.stringify({ error: 'Session ID is required' }), { status: 400 });
        const { data, error } = await supabase
          .from('work_sessions')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'delete-work-time': {
        const { id } = payload;
        if (!id) return new Response(JSON.stringify({ error: 'Session ID is required' }), { status: 400 });
        const { error } = await supabase.from('work_sessions').delete().eq('id', id);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      case 'create-work-time': {
        const { userId, ...sessionData } = payload;
        if (!userId) return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
        const { data, error } = await supabase
          .from('work_sessions')
          .insert({ user_id: userId, ...sessionData })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ session: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 });
      }

      case 'delete-work-hour-history': {
        if (!await checkPermission('personnel_files.manage')) throw new Error('Forbidden');
        const { id } = payload;
        if (!id) return new Response(JSON.stringify({ error: 'History ID is required' }), { status: 400 });
        const { error } = await supabaseAdmin.from('work_hours_history').delete().eq('id', id);
        if (error) throw error;
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      case 'get-annual-work-time-summary': {
        if (!await checkPermission('work_time.manage')) throw new Error('Forbidden');
        const { userId, year } = payload;
        if (!userId || !year) return new Response(JSON.stringify({ error: 'User ID and year are required' }), { status: 400 });
      
        const startDate = new Date(year, 0, 1).toISOString();
        const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
      
        const { data: sessions, error: sessionsError } = await supabaseAdmin
          .from('work_sessions')
          .select('*')
          .eq('user_id', userId)
          .gte('start_time', startDate)
          .lte('start_time', endDate);
        if (sessionsError) throw sessionsError;
      
        const { data: workHoursHistory, error: historyError } = await supabaseAdmin
          .from('work_hours_history')
          .select('*')
          .eq('user_id', userId)
          .lte('effective_date', endDate)
          .order('effective_date', { ascending: true });
        if (historyError) throw historyError;
      
        return new Response(JSON.stringify({ sessions, workHoursHistory }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'get-tour-billing-data': {
        if (!await checkPermission('Abrechnung Fernverkehr')) throw new Error('Forbidden');
        const { year, month } = payload;
        if (year === undefined || month === undefined) {
            return new Response(JSON.stringify({ error: 'Year and month are required' }), { status: 400 });
        }

        const { data: setting, error: settingError } = await supabaseAdmin
          .from('settings')
          .select('value')
          .eq('key', 'tour_billing_work_group_id')
          .single();
        if (settingError || !setting || !setting.value) {
          throw new Error('Arbeitsgruppe für die Abrechnung ist in den Einstellungen nicht konfiguriert.');
        }
        const workGroupId = Number(setting.value);

        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data: tours, error: toursError } = await supabaseAdmin
          .from('tours')
          .select('id, name, tour_type')
          .order('name');
        if (toursError) throw toursError;

        const { data: rosterIds, error: rosterIdsError } = await supabaseAdmin
          .from('duty_rosters')
          .select('id')
          .eq('work_group_id', workGroupId);
        if (rosterIdsError) throw rosterIdsError;
        
        let entries: any[] = [];
        if (rosterIds && rosterIds.length > 0) {
            const { data: rosterEntries, error: entriesError } = await supabaseAdmin
              .from('duty_roster_entries')
              .select('duty_date, tour_id, user_id')
              .in('roster_id', rosterIds.map(r => r.id))
              .gte('duty_date', startDate)
              .lte('duty_date', endDate);
            if (entriesError) throw entriesError;
            entries = rosterEntries || [];
        }

        const userIds = [...new Set(entries.map((e: any) => e.user_id))];
        let profilesMap = new Map();
        if (userIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabaseAdmin
                .from('profiles')
                .select('id, first_name, last_name')
                .in('id', userIds);
            if (profilesError) throw profilesError;
            profilesMap = new Map(profiles.map(p => [p.id, p]));
        }

        const { data: sessions, error: sessionsError } = await supabaseAdmin
          .from('work_sessions')
          .select('user_id, start_time, start_km, end_km')
          .in('user_id', userIds)
          .gte('start_time', new Date(year, month, 1).toISOString())
          .lt('start_time', new Date(year, month + 1, 1).toISOString());
        if (sessionsError) throw sessionsError;

        const { data: overrides, error: overridesError } = await supabaseAdmin
          .from('tour_billing_overrides')
          .select('*')
          .gte('billing_date', startDate)
          .lte('billing_date', endDate);
        if (overridesError) throw overridesError;

        const billingData: { [key: string]: { [key: number]: any } } = {};

        // First, process roster entries
        for (const entry of entries) {
          const dateKey = entry.duty_date;
          if (!billingData[dateKey]) {
            billingData[dateKey] = {};
          }
          
          const session = sessions.find((s: any) => 
            s.user_id === entry.user_id && 
            new Date(s.start_time).toDateString() === new Date(entry.duty_date).toDateString()
          );

          let kilometers = null;
          if (session && session.start_km != null && session.end_km != null) {
            kilometers = session.end_km - session.start_km;
          }

          const profile = profilesMap.get(entry.user_id);

          billingData[dateKey][entry.tour_id] = {
            userId: entry.user_id,
            firstName: profile?.first_name || null,
            lastName: profile?.last_name || null,
            kilometers: kilometers,
            is_override: false,
          };
        }

        // Now, layer overrides on top
        for (const override of overrides) {
            const dateKey = override.billing_date;
            const tourId = override.tour_id;

            if (!billingData[dateKey]) {
                billingData[dateKey] = {};
            }

            billingData[dateKey][tourId] = {
                ...billingData[dateKey][tourId],
                kilometers: override.kilometers,
                is_override: true,
            };
        }

        return new Response(JSON.stringify({ tours: tours || [], billingData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'save-tour-billing-overrides': {
        if (!await checkPermission('Abrechnung Fernverkehr')) throw new Error('Forbidden');
        const { overrides } = payload;
        if (!Array.isArray(overrides)) {
            return new Response(JSON.stringify({ error: 'Payload must be an array of overrides.' }), { status: 400 });
        }

        const toUpsert = overrides
            .filter((o: any) => o.kilometers !== null && o.kilometers !== '')
            .map((o: any) => ({
                billing_date: o.date,
                tour_id: o.tourId,
                kilometers: Number(o.kilometers),
                user_id: user.id,
            }));

        const toDelete = overrides
            .filter((o: any) => o.kilometers === null || o.kilometers === '')
            .map((o: any) => ({ date: o.date, tourId: o.tourId }));

        if (toUpsert.length > 0) {
            const { error: upsertError } = await supabaseAdmin
                .from('tour_billing_overrides')
                .upsert(toUpsert, { onConflict: 'tour_id,billing_date' });
            if (upsertError) throw upsertError;
        }

        if (toDelete.length > 0) {
            for (const item of toDelete) {
                await supabaseAdmin
                    .from('tour_billing_overrides')
                    .delete()
                    .match({ billing_date: item.date, tour_id: item.tourId });
            }
        }
        
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
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