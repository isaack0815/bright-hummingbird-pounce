import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { AddUserDialog } from '@/components/AddUserDialog';
import { EditUserDialog } from '@/components/EditUserDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from '@/utils/toast';

type User = {
  id: string;
  email?: string;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  roles: { id: number; name: string }[];
};

const fetchUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.functions.invoke('get-users');
  if (error) throw new Error(error.message);
  if (!data || !data.users) throw new Error("No users data returned");
  return data.users;
};

const UserManagement = () => {
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Benutzer erfolgreich gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Löschen des Benutzers.");
    },
  });

  const handleUserAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setIsEditUserDialogOpen(true);
  };

  const handleDeleteClick = (userId: string) => {
    if (window.confirm("Sind Sie sicher, dass Sie diesen Benutzer löschen möchten?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  if (error) {
    showError(`Fehler beim Laden der Benutzer: ${error.message}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Nutzerverwaltung</h1>
        <Button onClick={() => setIsAddUserDialogOpen(true)}>
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
          {isLoading ? (
            <p className="text-muted-foreground">Benutzer werden geladen...</p>
          ) : users && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Gruppen</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead>
                    <span className="sr-only">Aktionen</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'N/A'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {user.roles.length > 0 ? (
                          user.roles.map(role => <Badge key={role.id} variant="secondary">{role.name}</Badge>)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Menü umschalten</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditClick(user)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteClick(user.id)}
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
            <p className="text-muted-foreground">Keine Benutzer gefunden.</p>
          )}
        </CardContent>
      </Card>
      <AddUserDialog
        open={isAddUserDialogOpen}
        onOpenChange={setIsAddUserDialogOpen}
        onUserAdded={handleUserAdded}
      />
      <EditUserDialog
        user={selectedUser}
        open={isEditUserDialogOpen}
        onOpenChange={setIsEditUserDialogOpen}
      />
    </div>
  );
};

export default UserManagement;