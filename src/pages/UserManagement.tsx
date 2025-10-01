import { useState } from 'react';
import { Card, Button, Table, Badge } from 'react-bootstrap';
import { PlusCircle, Trash2, Edit, FileText, Users } from 'lucide-react';
import { AddUserDialog } from '@/components/AddUserDialog';
import { EditUserDialog } from '@/components/EditUserDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import TablePlaceholder from '@/components/TablePlaceholder';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

type User = {
  id: string;
  email?: string;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  roles: { id: number; name: string }[];
  work_groups: { id: number; name: string }[];
  entry_date?: string | null;
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
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

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
        <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => navigate('/work-groups')}>
                <Users className="me-2" size={16} />
                Arbeitsgruppen verwalten
            </Button>
            <Button onClick={() => setIsAddUserDialogOpen(true)}>
                <PlusCircle className="me-2" size={16} />
                Nutzer hinzufügen
            </Button>
        </div>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Benutzerliste</Card.Title>
          <Card.Text className="text-muted">Hier können Sie alle Benutzer sehen und verwalten.</Card.Text>
        </Card.Header>
        <Card.Body>
          {isLoading ? (
            <TablePlaceholder cols={7} />
          ) : users && users.length > 0 ? (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Benutzername</th>
                  <th>Email</th>
                  <th>Berechtigung</th>
                  <th>Arbeitsgruppen</th>
                  <th>Eintritt</th>
                  <th className="text-end">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="fw-medium">
                      {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'N/A'}
                    </td>
                    <td>{user.username}</td>
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
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        {user.work_groups.length > 0 ? (
                          user.work_groups.map(group => <Badge key={group.id} bg="info">{group.name}</Badge>)
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </div>
                    </td>
                    <td>{user.entry_date ? new Date(user.entry_date).toLocaleDateString() : '-'}</td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        {hasPermission('personnel_files.manage') && (
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/users/${user.id}/personnel-file`)}>
                            <FileText size={16} />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(user)}>
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteClick(user.id)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
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