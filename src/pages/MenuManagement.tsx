import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

const MenuManagement = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-foreground">Menüverwaltung</h1>
      <Card>
        <CardHeader>
          <CardTitle>Navigationsmenüs</CardTitle>
          <CardDescription>Passen Sie die Navigation für verschiedene Benutzergruppen an.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Die Verwaltungsoberfläche für Menüs wird hier in Kürze angezeigt.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MenuManagement;