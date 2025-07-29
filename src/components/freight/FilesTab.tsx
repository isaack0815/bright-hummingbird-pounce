import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FilesTab = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dateien</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Hier können Sie bald Dateien zum Auftrag hochladen, ansehen und löschen.
        </p>
      </CardContent>
    </Card>
  );
};

export default FilesTab;