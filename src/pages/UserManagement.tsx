import { useState } from 'react';
import { Card, Button, Table, Dropdown, Badge } from 'react-bootstrap';
import { PlusCircle, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { AddUserDialog } from '@/components/AddUserDialog';
import { EditUserDialog } from '@/components/EditUserDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import TablePlaceholder from '@/components/TablePlaceholder';

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
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h2">Nutzerverwaltung</h1>
        <Button onClick={() => setIsAddUserDialogOpen(true)}>
          <PlusCircle className="me-2" size={16} />
          Nutzer hinzufügen
        </Button>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Benutzerliste</Card.Title>
          <Card.Text className="text-muted">Hier können Sie alle Benutzer sehen und verwalten.</Card.Text>
        </Card.Header>
        <Card.Body>
          {isLoading ? (
            <TablePlaceholder cols={5} />
          ) : users && users.length > 0 ? (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Gruppen</th>
                  <th>Erstellt am</th>
                  <th className="text-end">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="fw-medium">
                      {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'N/A'}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        {user.roles.length > 0 ? (
                          user.roles.map(role => <Badge key={role.id} bg="secondary">{role.name}</Badge>)
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </div>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="text-end">
                      <Dropdown renderOnMount>
                        <Dropdown.Toggle variant="ghost" size="sm" id={`dropdown-user-${user.id}`}>
                          <MoreHorizontal size={16} />
                        </Dropdown.Toggle>
                        <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                          <Dropdown.Item onClick={() => handleEditClick(user)}>
                            <Edit className="me-2" size={16} /> Bearbeiten
                          </Dropdown.Item>
                          <Dropdown.Item
                            className="text-danger"
                            onClick={() => handleDeleteClick(user.id)}
                          >
                            <Trash2 className="me-2" size={16} /> Löschen
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-muted">Keine Benutzer gefunden.</p>
          )}
        </Card.Body>
      </Card>
      <AddUserDialog
        show={isAddUserDialogOpen}
        onHide={() => setIsAddUserDialogOpen(false)}
        onUserAdded={handleUserAdded}
      />
      {selectedUser && (
        <EditUserDialog
          user={selectedUser}
          show={isEditUserDialogOpen}
          onHide={() => setIsEditUserDialogOpen(false)}
        />
      )}
    </div>
  );
};

export default UserManagement;