import { ShieldOff } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const AccessDenied = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <ShieldOff className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-2xl font-bold text-foreground">Zugriff verweigert</h1>
      <p className="text-muted-foreground mt-2 mb-6">
        Sie haben nicht die erforderlichen Berechtigungen, um auf diese Seite zuzugreifen.
      </p>
      <Button asChild>
        <NavLink to="/">Zurück zum Dashboard</NavLink>
      </Button>
    </div>
  );
};

export default AccessDenied;