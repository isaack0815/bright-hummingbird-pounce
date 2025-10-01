import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorProvider } from './contexts/ErrorContext';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './lib/supabase';
import { SessionContextProvider } from '@supabase/auth-helpers-react';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from "./pages/Dashboard";
import UserManagement from './pages/UserManagement';
import RoleManagement from './pages/RoleManagement';
import MenuManagement from './pages/MenuManagement';
import CustomerManagement from './pages/CustomerManagement';
import FreightOrderManagement from './pages/FreightOrderManagement';
import FreightOrderForm from './pages/FreightOrderForm';
import VehicleManagement from './pages/VehicleManagement';
import VehicleForm from './pages/VehicleForm';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import AccessDenied from "./pages/AccessDenied";
import Fernverkehr from "./pages/Fernverkehr";
import BillingDetail from "./pages/BillingDetail";
import InvoiceManagement from "./pages/InvoiceManagement";
import DashboardSettings from "./pages/DashboardSettings";
import TourManagement from "./pages/TourManagement";
import VehicleGroupManagement from "./pages/VehicleGroupManagement";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
        <p className="text-dark">Sitzung wird geladen...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />} >
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/dashboard-settings" element={<DashboardSettings />} />
          
          <Route element={<ProtectedRoute requiredPermission="users.manage" />}>
            <Route path="users" element={<UserManagement />} />
          </Route>
          
          <Route element={<ProtectedRoute requiredPermission="roles.manage" />}>
            <Route path="roles" element={<RoleManagement />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="menus.manage" />}>
            <Route path="menus" element={<MenuManagement />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="settings.manage" />}>
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="customers.manage" />}>
            <Route path="customers" element={<CustomerManagement />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="vehicles.manage" />}>
            <Route path="vehicles" element={<VehicleManagement />} />
            <Route path="vehicles/new" element={<VehicleForm />} />
            <Route path="vehicles/edit/:id" element={<VehicleForm />} />
            <Route path="vehicle-groups" element={<VehicleGroupManagement />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="freight_orders.manage" />}>
            <Route path="freight-orders" element={<FreightOrderManagement />} />
            <Route path="freight-orders/new" element={<FreightOrderForm />} />
            <Route path="freight-orders/edit/:id" element={<FreightOrderForm />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="tours.manage" />}>
            <Route path="tours" element={<TourManagement />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="Abrechnung Fernverkehr" />}>
            <Route path="fernverkehr" element={<Fernverkehr />} />
            <Route path="billing/:id" element={<BillingDetail />} />
            <Route path="invoices" element={<InvoiceManagement />} />
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
      <ErrorProvider>
        <ErrorBoundary>
          <SessionContextProvider supabaseClient={supabase}>
            <AuthProvider>
              <Toaster position="bottom-right" />
              <AppRoutes />
            </AuthProvider>
          </SessionContextProvider>
        </ErrorBoundary>
      </ErrorProvider>
    </QueryClientProvider>
  );
};

export default App;