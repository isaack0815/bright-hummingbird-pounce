import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Table, Alert, Spinner, Badge, Row, Col } from 'react-bootstrap';
import TablePlaceholder from '@/components/TablePlaceholder';
import type { VerizonVehicle } from '@/types/verizon';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { VerizonMap } from '@/components/verizon/VerizonMap';

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
      <h1 className="h2 mb-4">Verizon Connect - Live-Karte</h1>
      
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

      {isLoading && <Spinner animation="border" />}

      {!isLoading && !error && vehicles && (
        <Row>
          <Col lg={8}>
            <VerizonMap vehicles={vehicles} />
          </Col>
          <Col lg={4}>
            <Card>
              <Card.Header>
                <Card.Title>Fahrzeugliste</Card.Title>
              </Card.Header>
              <Card.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {vehicles.length > 0 ? (
                  <Table responsive hover size="sm">
                    <thead>
                      <tr>
                        <th>Kennzeichen</th>
                        <th>Fahrer</th>
                        <th>Geschw.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <td className="fw-medium"><Badge bg="light" text="dark" className="border">{vehicle.licensePlate}</Badge></td>
                          <td>{vehicle.driverName || '-'}</td>
                          <td>{vehicle.speed.value} {vehicle.speed.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <p className="text-muted text-center py-4">Keine Fahrzeuge mit Verizon ID gefunden.</p>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default VerizonConnect;