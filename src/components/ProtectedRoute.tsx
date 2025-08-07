import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/utils/toast';

type ProtectedRouteProps = {
  requiredPermission?: string;
  children?: React.ReactElement;
};

const ProtectedRoute = ({ requiredPermission, children }: ProtectedRouteProps) => {
  const { isLoading, hasPermission, session } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Lade Sitzung...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    showError("Zugriff verweigert. Sie haben nicht die erforderliche Berechtigung.");
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;