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
    // onAuthStateChange is called when the user signs in, signs out, or when the token is refreshed.
    // It is also called once when the client is initialized and a session is found, so we don't
    // need a separate getSession() call. This is the most robust way to handle auth state.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session) {
        const { data, error } = await supabase.rpc('get_my_permissions');
        if (error) {
          console.error("Error fetching permissions:", error);
          setPermissions([]);
        } else {
          setPermissions(data.map((p: { permission_name: string }) => p.permission_name));
        }
      } else {
        // If there is no session, clear permissions
        setPermissions([]);
      }
      // Set loading to false after the initial check has been performed.
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (permission: string) => {
    // A simple way to grant all permissions to an 'Admin' role.
    // This assumes the 'Admin' role has been granted all relevant permissions in the database.
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