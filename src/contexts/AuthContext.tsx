import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  permissions: string[];
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This function handles the initial fetch of the session when the app loads.
    const fetchInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        setSession(session);
        setUser(session?.user ?? null);

        if (session) {
          const { data: perms, error: permError } = await supabase.rpc('get_my_permissions');
          if (permError) throw permError;
          setPermissions(perms.map((p: { permission_name: string }) => p.permission_name));
        } else {
          setPermissions([]);
        }
      } catch (error) {
        console.error("Error fetching initial session:", error);
        setPermissions([]);
      } finally {
        // Crucially, we always stop loading, even if there was an error.
        setIsLoading(false);
      }
    };

    fetchInitialSession();

    // This listener handles subsequent auth changes (SIGN_IN, SIGN_OUT, etc.).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session) {
        const { data, error } = await supabase.rpc('get_my_permissions');
        if (error) {
          console.error("Error refetching permissions on auth change:", error);
          setPermissions([]);
        } else {
          setPermissions(data.map((p: { permission_name: string }) => p.permission_name));
        }
      } else {
        setPermissions([]);
      }
       // Also set loading to false here to handle the case where the listener fires before the initial fetch completes.
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (permission: string) => {
    if (permissions.includes('roles.manage') && permissions.includes('users.manage')) {
        return true;
    }
    return permissions.includes(permission);
  };

  const value = { session, user, permissions, isLoading, hasPermission };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};