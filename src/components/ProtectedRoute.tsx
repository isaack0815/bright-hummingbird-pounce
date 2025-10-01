import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/utils/toast';

type ProtectedRouteProps = {
  requiredPermission: string;
};

const ProtectedRoute = ({ requiredPermission }: ProtectedRouteProps) => {
  const { isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Lade Berechtigungen...</p>
      </div>
    );
  }

  if (!hasPermission(requiredPermission)) {
    showError("Zugriff verweigert. Sie haben nicht die erforderliche Berechtigung.");
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;