import { useState } from 'react';
import { Card, Button, Table } from 'react-bootstrap';
import { PlusCircle, Trash2, Edit, ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { NavLink } from 'react-router-dom';
import TablePlaceholder from '@/components/TablePlaceholder';
import type { WorkGroup } from '@/types/workgroup';
import { AddWorkGroupDialog } from '@/components/work-group/AddWorkGroupDialog';
import { EditWorkGroupDialog } from '@/components/work-group/EditWorkGroupDialog';

const fetchWorkGroups = async (): Promise<WorkGroup[]> => {
  const { data: groupsData, error: groupsError } = await supabase
    .from('work_groups')
    .select(`id, name, description, user_work_groups(user_id)`)
    .order('name');

  if (groupsError) throw new Error(groupsError.message);
  if (!groupsData) return [];

  const allUserIds = [...new Set(groupsData.flatMap(g => g.user_work_groups.map((m: any) => m.user_id)))];

  if (allUserIds.length === 0) {
    return groupsData.map(group => {
      const { user_work_groups, ...restOfGroup } = group;
      return { ...restOfGroup, members: [] };
    });
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', allUserIds);

  if (profilesError) throw new Error(profilesError.message);
  if (!profiles) return [];

  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  const groupsWithMembers = groupsData.map(group => {
    const members = group.user_work_groups.map((m: any) => profilesMap.get(m.user_id)).filter(Boolean);
    const { user_work_groups, ...restOfGroup } = group;
    return { ...restOfGroup, members };
  });

  return groupsWithMembers;
};

const WorkGroupManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<WorkGroup | null>(null);
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery<WorkGroup[]>({
    queryKey: ['workGroups'],
    queryFn: fetchWorkGroups,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-work-group', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Arbeitsgruppe gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['workGroups'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen."),
  });

  const handleEditClick = (group: WorkGroup) => {
    setSelectedGroup(group);
    setIsEditDialogOpen(true);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
            <NavLink to="/users" className="btn btn-outline-secondary p-2 lh-1"><ArrowLeft size={16} /></NavLink>
            <h1 className="h2 mb-0">Arbeitsgruppen</h1>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="me-2" size={16} />
          Gruppe hinzufügen
        </Button>
      </div>
      <Card>
        <Card.Body>
          {isLoading ? (
            <TablePlaceholder cols={4} />
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Beschreibung</th>
                  <th>Mitglieder</th>
                  <th className="text-end">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {groups?.map((group) => (
                  <tr key={group.id}>
                    <td className="fw-medium">{group.name}</td>
                    <td>{group.description}</td>
                    <td>{group.members.length}</td>
                    <td className="text-end">
                      <Button variant="ghost" size="sm" onClick={() => handleEditClick(group)}><Edit size={16} /></Button>
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => deleteMutation.mutate(group.id)}><Trash2 size={16} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      <AddWorkGroupDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} />
      <EditWorkGroupDialog group={selectedGroup} show={isEditDialogOpen} onHide={() => setIsEditDialogOpen(false)} />
    </div>
  );
};

export default WorkGroupManagement;