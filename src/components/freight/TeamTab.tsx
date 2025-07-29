import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TeamTab = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Hier können Sie bald Benutzer zu diesem Auftrag zuweisen.
        </p>
      </CardContent>
    </Card>
  );
};

export default TeamTab;