import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { useSession, useUser } from '@supabase/auth-helpers-react';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  permissions: string[];
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const user = useUser();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsPermissionsLoading(true);

    async function fetchPermissions() {
      if (user) {
        try {
          const { data, error } = await supabase.rpc('get_my_permissions');
          if (error) throw error;
          if (isMounted) {
            setPermissions(data.map((p: { permission_name: string }) => p.permission_name));
          }
        } catch (error) {
          console.error("Error fetching permissions:", error);
          if (isMounted) setPermissions([]);
        } finally {
          if (isMounted) setIsPermissionsLoading(false);
        }
      } else {
        if (isMounted) {
          setPermissions([]);
          setIsPermissionsLoading(false);
        }
      }
    }

    fetchPermissions();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const hasPermission = (permission: string) => {
    // This is a special rule for "super admins" who can manage both users and roles.
    if (permissions.includes('roles.manage') && permissions.includes('users.manage')) {
      return true;
    }
    return permissions.includes(permission);
  };

  const value = { 
    session, 
    user, 
    permissions, 
    isLoading: isPermissionsLoading, // The main loading state now only depends on permissions
    hasPermission 
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};