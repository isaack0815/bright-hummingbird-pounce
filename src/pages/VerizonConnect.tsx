import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Table, Alert, Spinner, Badge, Row, Col, Button, ListGroup } from 'react-bootstrap';
import type { VerizonVehicle } from '@/types/verizon';
import { VerizonMap } from '@/components/verizon/VerizonMap';
import { showError, showSuccess } from '@/utils/toast';
import { ArrowRight, Clock, RefreshCw, Trash2, Save } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const fetchVerizonVehicles = async (): Promise<VerizonVehicle[]> => {
  const { data, error } = await supabase.functions.invoke('get-verizon-vehicles');
  if (error) {
    if (data && data.error) throw new Error(data.error);
    throw new Error(error.message);
  }
  return data.vehicles;
};

const fetchPlannedTour = async (vehicleId: string) => {
    const { data, error } = await supabase.functions.invoke('action', {
        body: { 
            action: 'get-planned-tour-for-vehicle',
            payload: { vehicleId: parseInt(vehicleId, 10) }
        }
    });
    if (error) throw error;
    return data.tour;
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
  const [tourChain, setTourChain] = useState<any[]>([]);
  const [potentialFollowUps, setPotentialFollowUps] = useState<any[] | null>(null);
  const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);
  const queryClient = useQueryClient();

  const { data: vehicles, isLoading, error } = useQuery<VerizonVehicle[]>({
    queryKey: ['verizonVehicles'],
    queryFn: fetchVerizonVehicles,
    retry: false,
  });

  const { data: plannedTour, isLoading: isLoadingTour, refetch: refetchPlannedTour } = useQuery({
      queryKey: ['plannedTourForVehicle', selectedVehicleId],
      queryFn: () => fetchPlannedTour(selectedVehicleId!),
      enabled: !!selectedVehicleId,
  });

  const saveTourMutation = useMutation({
    mutationFn: async () => {
        if (!selectedVehicleId) {
            throw new Error("Kein Fahrzeug ausgewählt.");
        }
        const orderIdsToUpdate = tourChain.map(order => order.id);
        const { error } = await supabase.functions.invoke('action', {
            body: {
                action: 'assign-vehicle-to-orders',
                payload: {
                    vehicleId: selectedVehicleId,
                    orderIds: orderIdsToUpdate,
                }
            }
        });
        if (error) throw error;
    },
    onSuccess: () => {
        showSuccess("Tour erfolgreich gespeichert und Aufträge zugewiesen!");
        queryClient.invalidateQueries({ queryKey: ['verizonVehicles'] });
        queryClient.invalidateQueries({ queryKey: ['plannedTourForVehicle', selectedVehicleId] });
        setTourChain([]);
        setPotentialFollowUps(null);
        setSelectedVehicleId(null);
    },
    onError: (err: any) => {
        showError(err.data?.error || err.message || "Fehler beim Speichern der Tour.");
    }
  });

  useEffect(() => {
    if (plannedTour) {
      setTourChain(plannedTour);
      if (plannedTour.length > 0) {
        handleFindFollowUpTrips(plannedTour[plannedTour.length - 1].id);
      } else {
        setPotentialFollowUps(null);
      }
    } else if (selectedVehicleId) {
      setTourChain([]);
      setPotentialFollowUps(null);
    }
  }, [plannedTour, selectedVehicleId]);

  const handleVehicleSelect = (vehicleId: string) => {
    const newVehicleId = selectedVehicleId === vehicleId ? null : vehicleId;
    setSelectedVehicleId(newVehicleId);
  };

  const handleFindFollowUpTrips = async (orderId: number) => {
    setIsLoadingFollowUp(true);
    setPotentialFollowUps(null);
    try {
      const orders = await fetchFollowUpOrders(orderId);
      setPotentialFollowUps(orders);
    } catch (err: any) {
      showError(err.data?.error || err.message || "Fehler bei der Suche nach Folgeaufträgen.");
    } finally {
      setIsLoadingFollowUp(false);
    }
  };

  const handleSelectFollowUp = (order: any) => {
    const newTourChain = [...tourChain, order];
    setTourChain(newTourChain);
    handleFindFollowUpTrips(order.id);
  };

  const handleRemoveLastStop = () => {
    if (tourChain.length === 0) return;
    const newTourChain = tourChain.slice(0, -1);
    setTourChain(newTourChain);
    if (newTourChain.length > 0) {
      const lastOrder = newTourChain[newTourChain.length - 1];
      handleFindFollowUpTrips(lastOrder.id);
    } else {
      setPotentialFollowUps(null);
    }
  };

  const handleResetTour = () => {
    refetchPlannedTour();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Tourenplanung Fracht</h1>
        <Button 
            onClick={() => saveTourMutation.mutate()} 
            disabled={!selectedVehicleId || saveTourMutation.isPending}
        >
            {saveTourMutation.isPending ? <Spinner size="sm" className="me-2" /> : <Save size={16} className="me-2" />}
            Tour speichern
        </Button>
      </div>
      
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
            <VerizonMap vehicles={vehicles} tourChain={tourChain} />
          </Col>
          <Col lg={4}>
            <div className="d-flex flex-column gap-4">
              <Card>
                <Card.Header><Card.Title>Fahrzeugliste</Card.Title></Card.Header>
                <Card.Body style={{ maxHeight: '30vh', overflowY: 'auto' }}>
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

              {tourChain.length > 0 && (
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <Card.Title>Geplante Tour</Card.Title>
                    <div>
                      {tourChain.length > 0 && (
                        <Button variant="outline-danger" size="sm" onClick={handleRemoveLastStop} className="me-2"><Trash2 size={14} /></Button>
                      )}
                      <Button variant="outline-secondary" size="sm" onClick={handleResetTour}><RefreshCw size={14} className="me-1" /> Zurücksetzen</Button>
                    </div>
                  </Card.Header>
                  <ListGroup variant="flush" style={{ maxHeight: '25vh', overflowY: 'auto' }}>
                    {tourChain.map((order, index) => (
                      <ListGroup.Item key={order.id} active={index === 0}>
                        <strong>{index === 0 ? 'Start:' : `Stopp ${index + 1}:`}</strong> <NavLink to={`/freight-orders/edit/${order.id}`} className={index === 0 ? 'text-white' : ''}>{order.order_number}</NavLink>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </Card>
              )}

              {(isLoadingTour || isLoadingFollowUp) && <div className="text-center"><Spinner /></div>}
              
              {potentialFollowUps && (
                <Card>
                  <Card.Header><Card.Title>Mögliche Folgeaufträge</Card.Title></Card.Header>
                  <Card.Body style={{ maxHeight: '30vh', overflowY: 'auto' }}>
                    {potentialFollowUps.length > 0 ? (
                      <ListGroup variant="flush">
                        {potentialFollowUps.map(order => (
                          <ListGroup.Item key={order.id} action onClick={() => handleSelectFollowUp(order)} disabled={order.is_overweight}>
                            <div className="d-flex justify-content-between align-items-center">
                              <span className="fw-bold">{order.order_number}</span>
                              <div>
                                {order.is_overweight && <Badge bg="danger" className="me-2">Zu schwer</Badge>}
                                <Badge bg="info"><Clock size={12} className="me-1" /> ~{order.travel_duration_hours}h Anfahrt</Badge>
                              </div>
                            </div>
                            <p className="small text-muted mb-0">{order.origin_address} <ArrowRight size={12} /> {order.destination_address}</p>
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