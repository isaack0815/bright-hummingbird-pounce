import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

const RoleManagement = () => {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Rechte- & Gruppenverwaltung</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Gruppe hinzufügen
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Rollen und Berechtigungen</CardTitle>
          <CardDescription>Verwalten Sie hier Benutzergruppen und deren Zugriffsrechte.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Die Verwaltungsoberfläche für Rollen wird hier in Kürze angezeigt.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleManagement;