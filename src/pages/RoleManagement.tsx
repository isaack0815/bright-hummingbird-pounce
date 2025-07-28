import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { AddRoleDialog } from '@/components/AddRoleDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Role = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

const fetchRoles = async (): Promise<Role[]> => {
  const { data, error } = await supabase.functions.invoke('get-roles');
  if (error) throw new Error(error.message);
  return data.roles;
};

const RoleManagement = () => {
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: roles, isLoading, error } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: fetchRoles,
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-role', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Gruppe erfolgreich gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Löschen der Gruppe.");
    },
  });

  if (error) {
    showError(`Fehler beim Laden der Gruppen: ${error.message}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Rechte- & Gruppenverwaltung</h1>
        <Button onClick={() => setIsAddRoleDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Gruppe hinzufügen
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gruppenliste</CardTitle>
          <CardDescription>Verwalten Sie hier Benutzergruppen und deren Zugriffsrechte.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Gruppen werden geladen...</p>
          ) : roles && roles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>
                    <span className="sr-only">Aktionen</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Menü</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                          <DropdownMenuItem disabled>Bearbeiten</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteRoleMutation.mutate(role.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">Keine Gruppen gefunden. Fügen Sie eine neue Gruppe hinzu.</p>
          )}
        </CardContent>
      </Card>
      <AddRoleDialog open={isAddRoleDialogOpen} onOpenChange={setIsAddRoleDialogOpen} />
    </div>
  );
};

export default RoleManagement;