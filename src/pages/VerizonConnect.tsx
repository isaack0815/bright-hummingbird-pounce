import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Table, Alert, Spinner, Badge } from 'react-bootstrap';
import TablePlaceholder from '@/components/TablePlaceholder';
import type { VerizonVehicle } from '@/types/verizon';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const fetchVerizonVehicles = async (): Promise<VerizonVehicle[]> => {
  const { data, error } = await supabase.functions.invoke('get-verizon-vehicles');
  if (error) {
    if (data && data.error) {
      throw new Error(data.error);
    }
    throw new Error(error.message);
  }
  return data.vehicles;
};

const VerizonConnect = () => {
  const { data: vehicles, isLoading, error } = useQuery<VerizonVehicle[]>({
    queryKey: ['verizonVehicles'],
    queryFn: fetchVerizonVehicles,
    retry: false,
  });

  return (
    <div>
      <h1 className="h2 mb-4">Verizon Connect - Fahrzeugübersicht</h1>
      <Card>
        <Card.Header>
          <Card.Title>Live-Fahrzeugdaten</Card.Title>
          <Card.Text className="text-muted">
            Diese Daten werden direkt von der Verizon Connect API abgerufen.
          </Card.Text>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger">
              <Alert.Heading>Fehler beim Abrufen der Daten</Alert.Heading>
              <p>{error.message}</p>
              <hr />
              <p className="mb-0">
                Stellen Sie sicher, dass die Secrets `VERIZON_USERNAME` und `VERIZON_PASSWORD` in den Supabase-Projekteinstellungen korrekt hinterlegt sind.
              </p>
            </Alert>
          )}
          {isLoading ? (
            <TablePlaceholder cols={5} />
          ) : vehicles && vehicles.length > 0 ? (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Kennzeichen</th>
                  <th>Verizon ID</th>
                  <th>Fahrer-Nr.</th>
                  <th>Geschwindigkeit</th>
                  <th>Letzter Kontakt</th>
                  <th>Standort</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="fw-medium"><Badge bg="light" text="dark" className="border">{vehicle.licensePlate}</Badge></td>
                    <td>{vehicle.vehicleName}</td>
                    <td>{vehicle.driverName || '-'}</td>
                    <td>{vehicle.speed ? `${vehicle.speed.value} ${vehicle.speed.unit}` : '-'}</td>
                    <td>{vehicle.lastContactTime ? format(parseISO(vehicle.lastContactTime), 'dd.MM.yyyy HH:mm', { locale: de }) : '-'}</td>
                    <td>{vehicle.location?.address || `${vehicle.location?.latitude}, ${vehicle.location?.longitude}`}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            !error && <p className="text-muted text-center py-4">Keine Fahrzeuge mit Verizon ID gefunden. Bitte pflegen Sie die IDs in der Fahrzeugverwaltung.</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default VerizonConnect;