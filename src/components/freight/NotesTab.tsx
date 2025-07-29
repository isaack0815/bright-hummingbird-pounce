import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NotesTab = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notizen</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Hier können Sie bald Notizen zum Auftrag hinzufügen und einsehen.
        </p>
      </CardContent>
    </Card>
  );
};

export default NotesTab;