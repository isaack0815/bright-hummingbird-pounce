import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

const UserManagement = () => {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Nutzerverwaltung</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nutzer hinzufügen
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Benutzerliste</CardTitle>
          <CardDescription>Hier können Sie alle Benutzer sehen und verwalten.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Die Benutzertabelle wird hier in Kürze angezeigt.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;