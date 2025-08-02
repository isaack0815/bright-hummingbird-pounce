import { ShieldOff } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const AccessDenied = () => {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center">
      <ShieldOff className="text-danger mb-4" size={64} />
      <h1 className="h2">Zugriff verweigert</h1>
      <p className="text-muted mt-2 mb-4">
        Sie haben nicht die erforderlichen Berechtigungen, um auf diese Seite zuzugreifen.
      </p>
      <NavLink to="/" className="btn btn-primary">Zurück zum Dashboard</NavLink>
    </div>
  );
};

export default AccessDenied;