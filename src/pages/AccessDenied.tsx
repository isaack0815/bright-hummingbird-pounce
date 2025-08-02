import { ShieldOff } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from 'react-bootstrap';

const AccessDenied = () => {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center">
      <ShieldOff className="text-danger mb-4" size={64} />
      <h1 className="h2">Zugriff verweigert</h1>
      <p className="text-muted mt-2 mb-4">
        Sie haben nicht die erforderlichen Berechtigungen, um auf diese Seite zuzugreifen.
      </p>
      <Button as={NavLink} to="/">Zurück zum Dashboard</Button>
    </div>
  );
};

export default AccessDenied;