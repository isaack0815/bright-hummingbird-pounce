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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setSession(session);
        setUser(session?.user ?? null);

        if (session) {
          const { data, error } = await supabase.rpc('get_my_permissions');
          if (error) {
            throw error;
          }
          setPermissions(data.map((p: { permission_name: string }) => p.permission_name));
        } else {
          setPermissions([]);
        }
      } catch (error) {
        console.error("Error during onAuthStateChange:", error);
        setPermissions([]); // Clear permissions on error as a safeguard
      } finally {
        // This block ensures that loading is always set to false,
        // preventing the app from getting stuck on the loading screen.
        setIsLoading(false);
      }
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