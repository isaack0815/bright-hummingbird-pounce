import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ErrorProvider } from '@/contexts/ErrorContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { Spinner } from 'react-bootstrap';
import { Toaster } from 'react-hot-toast';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const DriverDashboard = lazy(() => import('@/pages/DriverDashboard'));
const RoleManagement = lazy(() => import('@/pages/RoleManagement'));
const AccessDenied = lazy(() => import('@/pages/AccessDenied'));
const MenuManagement = lazy(() => import('@/pages/MenuManagement'));
const FreightOrderManagement = lazy(() => import('@/pages/FreightOrderManagement'));
const FreightOrderForm = lazy(() => import('@/pages/FreightOrderForm'));
const CustomerManagement = lazy(() => import('@/pages/CustomerManagement'));
const Fernverkehr = lazy(() => import('@/pages/Fernverkehr'));
const BillingDetail = lazy(() => import('@/pages/BillingDetail'));
const InvoiceManagement = lazy(() => import('@/pages/InvoiceManagement'));
const DashboardSettings = lazy(() => import('@/pages/DashboardSettings'));
const VehicleManagement = lazy(() => import('@/pages/VehicleManagement'));
const VehicleForm = lazy(() => import('@/pages/VehicleForm'));
const VehicleGroupManagement = lazy(() => import('@/pages/VehicleGroupManagement'));
const TourManagement = lazy(() => import('@/pages/TourManagement'));
const CustomerDetail = lazy(() => import('@/pages/CustomerDetail'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const Profile = lazy(() => import('@/pages/Profile'));
const DriverProfile = lazy(() => import('@/pages/DriverProfile'));
const PersonnelFile = lazy(() => import('@/pages/PersonnelFile'));
const Settings = lazy(() => import('@/pages/Settings'));
const EmailClient = lazy(() => import('@/pages/EmailClient'));
const SimpleEmailClient = lazy(() => import('@/pages/SimpleEmailClient'));
const FileManager = lazy(() => import('@/pages/FileManager'));
const WorkGroupManagement = lazy(() => import('@/pages/WorkGroupManagement'));
const DutyRoster = lazy(() => import('@/pages/DutyRoster'));
const OrderImport = lazy(() => import('@/pages/OrderImport'));
const VerizonConnect = lazy(() => import('@/pages/VerizonConnect'));
const WorkTimeManagement = lazy(() => import('@/pages/WorkTimeManagement'));
const WorkTimeAdministration = lazy(() => import('@/pages/WorkTimeAdministration'));
const WorkTimeAnnualSummary = lazy(() => import('@/pages/WorkTimeAnnualSummary'));
const VacationRequestManagement = lazy(() => import('@/pages/VacationRequestManagement'));
const VehicleAnalytics = lazy(() => import('@/pages/VehicleAnalytics'));
const TourBilling = lazy(() => import('@/pages/TourBilling'));
const Dispatch = lazy(() => import('@/pages/Dispatch'));
const OrganizationChart = lazy(() => import('@/pages/OrganizationChart'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return <div className="vh-100 d-flex justify-content-center align-items-center"><Spinner animation="border" /></div>;
  }

  return (
    <Router>
      <Suspense fallback={<div className="vh-100 d-flex justify-content-center align-items-center"><Spinner animation="border" /></div>}>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/driver/dashboard" element={<ProtectedRoute requiredPermission="driver.dashboard.access"><DriverDashboard /></ProtectedRoute>} />
            <Route path="/driver/profile" element={<DriverProfile />} />
            <Route path="/profile/dashboard-settings" element={<DashboardSettings />} />
            <Route path="/fernverkehr" element={<ProtectedRoute requiredPermission="Abrechnung Fernverkehr"><Fernverkehr /></ProtectedRoute>} />
            <Route path="/freight-orders" element={<FreightOrderManagement />} />
            <Route path="/freight-orders/new" element={<FreightOrderForm />} />
            <Route path="/freight-orders/edit/:id" element={<FreightOrderForm />} />
            <Route path="/fernverkehr/:orderId" element={<ProtectedRoute requiredPermission="Abrechnung Fernverkehr"><BillingDetail /></ProtectedRoute>} />
            <Route path="/invoices" element={<InvoiceManagement />} />
            <Route path="/customers" element={<CustomerManagement />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/tours" element={<TourManagement />} />
            <Route path="/tour-billing" element={<ProtectedRoute requiredPermission="Abrechnung Fernverkehr"><TourBilling /></ProtectedRoute>} />
            <Route path="/vehicles" element={<VehicleManagement />} />
            <Route path="/vehicles/new" element={<VehicleForm />} />
            <Route path="/vehicles/edit/:id" element={<VehicleForm />} />
            <Route path="/vehicle-groups" element={<VehicleGroupManagement />} />
            <Route path="/vehicle-analytics" element={<ProtectedRoute requiredPermission="vehicles.manage"><VehicleAnalytics /></ProtectedRoute>} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/users/:id/personnel-file" element={<PersonnelFile />} />
            <Route path="/organization-chart" element={<ProtectedRoute requiredPermission="users.manage"><OrganizationChart /></ProtectedRoute>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/roles" element={<RoleManagement />} />
            <Route path="/work-groups" element={<ProtectedRoute requiredPermission="users.manage"><WorkGroupManagement /></ProtectedRoute>} />
            <Route path="/duty-roster" element={<ProtectedRoute requiredPermission="roster.manage"><DutyRoster /></ProtectedRoute>} />
            <Route path="/menus" element={<MenuManagement />} />
            <Route path="/email" element={<EmailClient />} />
            <Route path="/simple-email" element={<SimpleEmailClient />} />
            <Route path="/file-manager" element={<ProtectedRoute requiredPermission="file_manager.access"><FileManager /></ProtectedRoute>} />
            <Route path="/order-import" element={<ProtectedRoute><OrderImport /></ProtectedRoute>} />
            <Route path="/verizon-connect" element={<ProtectedRoute><VerizonConnect /></ProtectedRoute>} />
            <Route path="/work-time" element={<WorkTimeManagement />} />
            <Route path="/work-time-admin" element={<ProtectedRoute requiredPermission="work_time.manage"><WorkTimeAdministration /></ProtectedRoute>} />
            <Route path="/work-time-admin/annual-summary" element={<ProtectedRoute requiredPermission="work_time.manage"><WorkTimeAnnualSummary /></ProtectedRoute>} />
            <Route path="/vacation-requests" element={<VacationRequestManagement />} />
            <Route path="/dispatch" element={<ProtectedRoute><Dispatch /></ProtectedRoute>} />
            <Route path="/access-denied" element={<AccessDenied />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionContextProvider supabaseClient={supabase}>
        <ErrorProvider>
          <ErrorBoundary>
            <AuthProvider>
              <Toaster position="bottom-right" />
              <AppRoutes />
            </AuthProvider>
          </ErrorBoundary>
        </ErrorProvider>
      </SessionContextProvider>
    </QueryClientProvider>
  );
}

export default App;