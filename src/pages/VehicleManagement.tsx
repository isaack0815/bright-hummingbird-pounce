import { useState, useMemo } from 'react';
import { Card, Button, Form, Table, Dropdown, Badge } from 'react-bootstrap';
import { PlusCircle, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { useError } from '@/contexts/ErrorContext';
import type { Vehicle } from '@/types/vehicle';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import TablePlaceholder from '@/components/TablePlaceholder';

const fetchVehicles = async (): Promise<Vehicle[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicles');
  if (error) throw new Error(error.message);
  return data.vehicles;
};

const VehicleManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { addError } = useError();
  const navigate = useNavigate();

  const { data: vehicles, isLoading, error } = useQuery<Vehicle[]>({
    queryKey: ['vehicles'],
    queryFn: fetchVehicles,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-vehicle', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Fahrzeug erfolgreich gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.message || "Fehler beim Löschen des Fahrzeugs.");
    },
  });

  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    return vehicles.filter(vehicle =>
      vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vehicle.brand && vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.model && vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.vin && vehicle.vin.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.profiles && `${vehicle.profiles.first_name} ${vehicle.profiles.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [vehicles, searchTerm]);

  const getDateBadgeVariant = (dateStr: string | null): string => {
    if (!dateStr) return 'secondary';
    try {
      const daysUntil = differenceInCalendarDays(parseISO(dateStr), new Date());
      if (daysUntil < 0) return 'danger';
      if (daysUntil <= 30) return 'warning';
      return 'secondary';
    } catch (e) {
      console.error("Error parsing date:", e);
      return 'secondary';
    }
  };

  if (error) {
    addError(error, 'API');
    showError(`Fehler beim Laden der Fahrzeuge: ${error.message}`);
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h2">Fahrzeugverwaltung</h1>
        <Button onClick={() => navigate('/vehicles/new')}>
          <PlusCircle className="me-2" size={16} />
          Fahrzeug hinzufügen
        </Button>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Fahrzeugliste</Card.Title>
          <Card.Text className="text-muted">Suchen, bearbeiten und verwalten Sie Ihren Fuhrpark.</Card.Text>
        </Card.Header>
        <Card.Body>
          <div className="mb-4">
            <Form.Control
              placeholder="Fahrzeuge suchen (Kennzeichen, Fahrer...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '24rem' }}
            />
          </div>
          {isLoading ? (
             <TablePlaceholder cols={8} />
          ) : filteredVehicles.length > 0 ? (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Kennzeichen</th>
                  <th>Marke & Modell</th>
                  <th>Fahrer</th>
                  <th>Status</th>
                  <th>Nächste HU</th>
                  <th>Service</th>
                  <th>Gasdurchsicht</th>
                  <th className="text-end"><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="fw-medium">{vehicle.license_plate}</td>
                    <td>{`${vehicle.brand || ''} ${vehicle.model || ''}`.trim()}</td>
                    <td>{vehicle.profiles ? `${vehicle.profiles.first_name || ''} ${vehicle.profiles.last_name || ''}`.trim() : '-'}</td>
                    <td><Badge bg={vehicle.status === 'Verfügbar' ? 'success' : 'secondary'}>{vehicle.status}</Badge></td>
                    <td>
                      <Badge bg={getDateBadgeVariant(vehicle.inspection_due_date)}>
                        {vehicle.inspection_due_date ? new Date(vehicle.inspection_due_date).toLocaleDateString() : '-'}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={getDateBadgeVariant(vehicle.next_service_date)}>
                        {vehicle.next_service_date ? new Date(vehicle.next_service_date).toLocaleDateString() : '-'}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={getDateBadgeVariant(vehicle.gas_inspection_due_date)}>
                        {vehicle.gas_inspection_due_date ? new Date(vehicle.gas_inspection_due_date).toLocaleDateString() : '-'}
                      </Badge>
                    </td>
                    <td className="text-end">
                      <Dropdown renderOnMount align="end">
                        <Dropdown.Toggle variant="ghost" size="sm"><MoreHorizontal size={16} /></Dropdown.Toggle>
                        <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                          <Dropdown.Header>Aktionen</Dropdown.Header>
                          <Dropdown.Item onClick={() => navigate(`/vehicles/edit/${vehicle.id}`)}><Edit className="me-2" size={16} />Bearbeiten</Dropdown.Item>
                          <Dropdown.Item className="text-danger" onClick={() => deleteMutation.mutate(vehicle.id)}><Trash2 className="me-2" size={16} />Löschen</Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-muted text-center py-4">Keine Fahrzeuge gefunden.</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default VehicleManagement;