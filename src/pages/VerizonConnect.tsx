import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Table, Alert, Spinner, Badge, Row, Col, Button, ListGroup } from 'react-bootstrap';
import type { VerizonVehicle } from '@/types/verizon';
import { VerizonMap } from '@/components/verizon/VerizonMap';
import { showError } from '@/utils/toast';
import { ArrowRight, Clock } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const fetchVerizonVehicles = async (): Promise<VerizonVehicle[]> => {
  const { data, error } = await supabase.functions.invoke('get-verizon-vehicles');
  if (error) {
    if (data && data.error) throw new Error(data.error);
    throw new Error(error.message);
  }
  return data.vehicles;
};

const fetchActiveOrder = async (vehicleId: string) => {
    const { data, error } = await supabase.functions.invoke('action', {
        body: { 
            action: 'get-active-order-for-vehicle',
            payload: { vehicleId: parseInt(vehicleId, 10) }
        }
    });
    if (error) throw error;
    return data.order;
}

const fetchFollowUpOrders = async (currentOrderId: number) => {
    const { data, error } = await supabase.functions.invoke('action', {
        body: {
            action: 'get-follow-up-freight',
            payload: { currentOrderId }
        }
    });
    if (error) throw error;
    return data.followUpOrders;
}

const VerizonConnect = () => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [followUpOrders, setFollowUpOrders] = useState<any[] | null>(null);
  const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);

  const { data: vehicles, isLoading, error } = useQuery<VerizonVehicle[]>({
    queryKey: ['verizonVehicles'],
    queryFn: fetchVerizonVehicles,
    retry: false,
  });

  const { data: activeOrder, isLoading: isLoadingOrder } = useQuery({
      queryKey: ['activeOrderForVehicle', selectedVehicleId],
      queryFn: () => fetchActiveOrder(selectedVehicleId!),
      enabled: !!selectedVehicleId,
  });

  const handleVehicleSelect = (vehicleId: string) => {
    const newVehicleId = selectedVehicleId === vehicleId ? null : vehicleId;
    setSelectedVehicleId(newVehicleId);
    setFollowUpOrders(null); // Reset follow-up orders when selection changes
  };

  const handleFindFollowUpTrips = async () => {
    if (!activeOrder) return;
    setIsLoadingFollowUp(true);
    setFollowUpOrders(null);
    try {
      const orders = await fetchFollowUpOrders(activeOrder.id);
      setFollowUpOrders(orders);
    } catch (err: any) {
      showError(err.data?.error || err.message || "Fehler bei der Suche nach Folgeaufträgen.");
    } finally {
      setIsLoadingFollowUp(false);
    }
  };

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
        <Row className="g-4">
          <Col lg={8}>
            <VerizonMap vehicles={vehicles} activeOrderRoute={activeOrder} />
          </Col>
          <Col lg={4}>
            <div className="d-flex flex-column gap-4">
              <Card>
                <Card.Header>
                  <Card.Title>Fahrzeugliste</Card.Title>
                </Card.Header>
                <Card.Body style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                  {vehicles.length > 0 ? (
                    <Table responsive hover size="sm">
                      <thead><tr><th>Kennzeichen</th><th>Fahrer</th><th>Geschw.</th></tr></thead>
                      <tbody>
                        {vehicles.map((vehicle) => (
                          <tr key={vehicle.id} onClick={() => handleVehicleSelect(vehicle.id)} className={vehicle.id === selectedVehicleId ? 'table-primary' : ''} style={{ cursor: 'pointer' }}>
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
              {selectedVehicleId && (
                <Card.Footer>
                  {isLoadingOrder ? <Spinner size="sm" /> : activeOrder ? (
                    <div>
                      <p className="small mb-2"><strong>Aktiver Auftrag:</strong> <NavLink to={`/freight-orders/edit/${activeOrder.id}`}>{activeOrder.order_number}</NavLink></p>
                      <Button size="sm" className="w-100" onClick={handleFindFollowUpTrips} disabled={isLoadingFollowUp}>
                        {isLoadingFollowUp ? <Spinner size="sm" /> : 'Mögliche Folgeaufträge suchen'}
                      </Button>
                    </div>
                  ) : (
                    <p className="small text-muted text-center mb-0">Kein aktiver Auftrag für dieses Fahrzeug gefunden.</p>
                  )}
                </Card.Footer>
              )}
              </Card>

              {isLoadingFollowUp && <div className="text-center"><Spinner /></div>}
              {followUpOrders && (
                <Card>
                  <Card.Header><Card.Title>Mögliche Folgeaufträge</Card.Title></Card.Header>
                  <Card.Body style={{ maxHeight: '30vh', overflowY: 'auto' }}>
                    {followUpOrders.length > 0 ? (
                      <ListGroup variant="flush">
                        {followUpOrders.map(order => (
                          <ListGroup.Item key={order.id}>
                            <div className="d-flex justify-content-between align-items-center">
                              <NavLink to={`/freight-orders/edit/${order.id}`}>{order.order_number}</NavLink>
                              <Badge bg="info"><Clock size={12} className="me-1" /> ~{order.travel_duration_hours}h Anfahrt</Badge>
                            </div>
                            <p className="small text-muted mb-0">{order.origin_address} <ArrowRight size={12} /> ...</p>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    ) : (
                      <p className="text-muted text-center">Keine passenden Folgeaufträge gefunden.</p>
                    )}
                  </Card.Body>
                </Card>
              )}
            </div>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default VerizonConnect;