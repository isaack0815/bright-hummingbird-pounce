import { useState } from 'react';
import { Card, Button, Table } from 'react-bootstrap';
import { PlusCircle, Trash2, Edit, ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { NavLink } from 'react-router-dom';
import TablePlaceholder from '@/components/TablePlaceholder';
import type { VehicleGroup } from '@/types/vehicle';
import { AddVehicleGroupDialog } from '@/components/vehicle/AddVehicleGroupDialog';
import { EditVehicleGroupDialog } from '@/components/vehicle/EditVehicleGroupDialog';

const fetchVehicleGroups = async (): Promise<VehicleGroup[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicle-groups');
  if (error) throw new Error(error.message);
  return data.groups;
};

const VehicleGroupManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<VehicleGroup | null>(null);
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery<VehicleGroup[]>({
    queryKey: ['vehicleGroups'],
    queryFn: fetchVehicleGroups,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-vehicle-group', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Gruppe gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['vehicleGroups'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen."),
  });

  const handleEditClick = (group: VehicleGroup) => {
    setSelectedGroup(group);
    setIsEditDialogOpen(true);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
            <NavLink to="/vehicles" className="btn btn-outline-secondary p-2 lh-1"><ArrowLeft size={16} /></NavLink>
            <h1 className="h2 mb-0">Fahrzeuggruppen</h1>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="me-2" size={16} />
          Gruppe hinzufügen
        </Button>
      </div>
      <Card>
        <Card.Body>
          {isLoading ? (
            <TablePlaceholder cols={3} />
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Beschreibung</th>
                  <th className="text-end">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {groups?.map((group) => (
                  <tr key={group.id}>
                    <td className="fw-medium">{group.name}</td>
                    <td>{group.description}</td>
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
      <AddVehicleGroupDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} />
      <EditVehicleGroupDialog group={selectedGroup} show={isEditDialogOpen} onHide={() => setIsEditDialogOpen(false)} />
    </div>
  );
};

export default VehicleGroupManagement;