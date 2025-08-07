import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ErrorProvider } from '@/contexts/ErrorContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { Spinner } from 'react-bootstrap';
import { Toaster } from 'react-hot-toast';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
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
const PersonnelFile = lazy(() => import('@/pages/PersonnelFile'));
const Settings = lazy(() => import('@/pages/Settings'));
const EmailClient = lazy(() => import('@/pages/EmailClient'));
// const EmailServiceTest = lazy(() => import('@/pages/EmailServiceTest')); // This is not a component
const NotFound = lazy(() => import('@/pages/NotFound'));

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
            <Route path="/dashboard/settings" element={<DashboardSettings />} />
            <Route path="/fernverkehr" element={<Fernverkehr />} />
            <Route path="/auftraege" element={<FreightOrderManagement />} />
            <Route path="/auftraege/neu" element={<FreightOrderForm />} />
            <Route path="/auftraege/:id/bearbeiten" element={<FreightOrderForm />} />
            <Route path="/abrechnung/:orderId" element={<BillingDetail />} />
            <Route path="/rechnungen" element={<InvoiceManagement />} />
            <Route path="/kunden" element={<CustomerManagement />} />
            <Route path="/kunden/:id" element={<CustomerDetail />} />
            <Route path="/touren" element={<TourManagement />} />
            <Route path="/fahrzeuge" element={<VehicleManagement />} />
            <Route path="/fahrzeuge/neu" element={<VehicleForm />} />
            <Route path="/fahrzeuge/:id/bearbeiten" element={<VehicleForm />} />
            <Route path="/fahrzeug-gruppen" element={<VehicleGroupManagement />} />
            <Route path="/benutzer" element={<UserManagement />} />
            <Route path="/benutzer/:id/akte" element={<PersonnelFile />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/einstellungen" element={<Settings />} />
            <Route path="/einstellungen/rollen" element={<RoleManagement />} />
            <Route path="/einstellungen/menue" element={<MenuManagement />} />
            <Route path="/email" element={<EmailClient />} />
            {/* <Route path="/email-service-test" element={<EmailServiceTest />} /> */}
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
    <ErrorProvider>
      <ErrorBoundary>
        <AuthProvider>
          <Toaster position="bottom-right" />
          <AppRoutes />
        </AuthProvider>
      </ErrorBoundary>
    </ErrorProvider>
  );
}

export default App;