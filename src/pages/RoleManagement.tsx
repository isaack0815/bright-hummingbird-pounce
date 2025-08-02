import { useState } from 'react';
import { Card, Button, Table, Dropdown, Badge } from 'react-bootstrap';
import { PlusCircle, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { AddRoleDialog } from '@/components/AddRoleDialog';
import { EditRoleDialog } from '@/components/EditRoleDialog';
import { useError } from '@/contexts/ErrorContext';
import TablePlaceholder from '@/components/TablePlaceholder';

type Permission = {
  id: number;
  name: string;
  description: string | null;
};

type Role = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  permissions: Permission[];
};

const fetchRoles = async (): Promise<Role[]> => {
  const { data, error } = await supabase.functions.invoke('get-roles');
  if (error) throw new Error(error.message);
  return data.roles;
};

const RoleManagement = () => {
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const queryClient = useQueryClient();
  const { addError } = useError();

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
      addError(err, 'API');
      showError(err.message || "Fehler beim Löschen der Gruppe.");
    },
  });

  const handleEditClick = (role: Role) => {
    setSelectedRole(role);
    setIsEditRoleDialogOpen(true);
  };

  if (error) {
    addError(error, 'API');
    showError(`Fehler beim Laden der Gruppen: ${error.message}`);
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h2">Rechte- & Gruppenverwaltung</h1>
        <Button onClick={() => setIsAddRoleDialogOpen(true)}>
          <PlusCircle className="me-2" size={16} />
          Gruppe hinzufügen
        </Button>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Gruppenliste</Card.Title>
          <Card.Text className="text-muted">Verwalten Sie hier Benutzergruppen und deren Zugriffsrechte.</Card.Text>
        </Card.Header>
        <Card.Body>
          {isLoading ? (
            <TablePlaceholder cols={4} />
          ) : roles && roles.length > 0 ? (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Beschreibung</th>
                  <th>Berechtigungen</th>
                  <th className="text-end">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td className="fw-medium">{role.name}</td>
                    <td>{role.description}</td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        {role.permissions.length > 0 ? (
                          role.permissions.map(p => <Badge key={p.id} bg="light" text="dark" className="border">{p.description || p.name}</Badge>)
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </div>
                    </td>
                    <td className="text-end">
                      <Dropdown>
                        <Dropdown.Toggle as={Button} variant="ghost" size="sm" id={`dropdown-role-${role.id}`} disabled={role.name === 'Admin'}>
                          <MoreHorizontal size={16} />
                        </Dropdown.Toggle>
                        <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                          <Dropdown.Item onClick={() => handleEditClick(role)}>
                            <Edit className="me-2" size={16} /> Bearbeiten
                          </Dropdown.Item>
                          <Dropdown.Item className="text-danger" onClick={() => deleteRoleMutation.mutate(role.id)}>
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
            <p className="text-muted">Keine Gruppen gefunden. Fügen Sie eine neue Gruppe hinzu.</p>
          )}
        </Card.Body>
      </Card>
      <AddRoleDialog show={isAddRoleDialogOpen} onHide={() => setIsAddRoleDialogOpen(false)} />
      <EditRoleDialog role={selectedRole} show={isEditRoleDialogOpen} onHide={() => setIsEditRoleDialogOpen(false)} />
    </div>
  );
};

export default RoleManagement;