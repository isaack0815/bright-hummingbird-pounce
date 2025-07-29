import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorProvider } from './contexts/ErrorContext';
import ErrorBoundary from './components/ErrorBoundary';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from "./pages/Dashboard";
import UserManagement from './pages/UserManagement';
import RoleManagement from './pages/RoleManagement';
import MenuManagement from './pages/MenuManagement';
import CustomerManagement from './pages/CustomerManagement';
import Profile from './pages/Profile';
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import AccessDenied from "./pages/AccessDenied";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          
          <Route element={<ProtectedRoute requiredPermission="users.manage" />}>
            <Route path="users" element={<UserManagement />} />
          </Route>
          
          <Route element={<ProtectedRoute requiredPermission="roles.manage" />}>
            <Route path="roles" element={<RoleManagement />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="menus.manage" />}>
            <Route path="menus" element={<MenuManagement />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="customers.manage" />}>
            <Route path="customers" element={<CustomerManagement />} />
          </Route>

          <Route path="access-denied" element={<AccessDenied />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorProvider>
          <ErrorBoundary>
            <AuthProvider>
              <Toaster />
              <Sonner />
              <AppRoutes />
            </AuthProvider>
          </ErrorBoundary>
        </ErrorProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;