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
    const getInitialData = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession) {
        const { data, error } = await supabase.rpc('get_my_permissions');
        if (error) {
          console.error("Error fetching permissions:", error);
          setPermissions([]);
        } else {
          setPermissions(data.map((p: { permission_name: string }) => p.permission_name));
        }
      }
      setIsLoading(false);
    };

    getInitialData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession) {
        const { data, error } = await supabase.rpc('get_my_permissions');
        if (error) {
          console.error("Error fetching permissions on auth change:", error);
          setPermissions([]);
        } else {
          setPermissions(data.map((p: { permission_name: string }) => p.permission_name));
        }
      } else {
        setPermissions([]);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasPermission = (permission: string) => {
    // Admins (users with the 'Admin' role which grants all permissions) have all rights.
    // A more robust check could be to see if 'Admin' role is present.
    // For now, checking for all known permissions is a good indicator.
    const isAdmin = ['users.manage', 'roles.manage', 'menus.manage'].every(p => permissions.includes(p));
    if (isAdmin) return true;
    
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