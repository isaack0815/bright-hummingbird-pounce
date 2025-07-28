import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from "./pages/Dashboard";
import UserManagement from './pages/UserManagement';
import RoleManagement from './pages/RoleManagement';
import MenuManagement from './pages/MenuManagement';
import Profile from './pages/Profile';
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ session }: { session: Session | null }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
            
            <Route element={<ProtectedRoute session={session} />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="roles" element={<RoleManagement />} />
              <Route path="menus" element={<MenuManagement />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;