import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, ListGroup, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { PlusCircle, Save, Trash2, GripVertical, Edit } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import type { Tour, TourStop, TourDetails, RoutePoint } from '@/types/tour';
import type { Vehicle } from '@/types/vehicle';
import type { Setting } from '@/types/settings';
import CreatableSelect from 'react-select/creatable';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TourMap } from '@/components/tour/TourMap';
import { AddTourDialog } from '@/components/tour/AddTourDialog';
import { EditTourStopDialog } from '@/components/tour/EditTourStopDialog';

// API Functions
const fetchTours = async (): Promise<Tour[]> => {
  const { data, error } = await supabase.functions.invoke('action', { body: { action: 'get-tours' } });
  if (error) throw error;
  return data.tours;
};

const fetchTourDetails = async (tourId: number): Promise<TourDetails> => {
  const { data, error } = await supabase.functions.invoke('action', { body: { action: 'get-tour-details', payload: { tourId } } });
  if (error) throw error;
  return data.tour;
};

const fetchTourStops = async (): Promise<TourStop[]> => {
  const { data, error } = await supabase.functions.invoke('action', { body: { action: 'get-tour-stops' } });
  if (error) throw error;
  return data.stops;
};

const fetchSettings = async (): Promise<Setting[]> => {
  const { data, error } = await supabase.functions.invoke('get-settings');
  if (error) throw new Error(error.message);
  return data.settings;
};

const fetchVehiclesByGroup = async (groupId: number | null): Promise<Vehicle[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicles-by-group', { body: { groupId } });
  if (error) throw new Error(error.message);
  return data.vehicles;
};

const weekdaysShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// Sortable Item Component
const SortableStopItem = ({ stop, onRemove, onEdit }: { stop: RoutePoint, onRemove: () => void, onEdit: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stop.route_point_id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const displayWeekdays = stop.weekdays?.sort().map(d => weekdaysShort[d]).join(', ') || 'Keine Tage';

  return (
    <ListGroup.Item ref={setNodeRef} style={style}>
      <Row className="align-items-center">
        <Col xs="auto">
          <Button variant="ghost" size="sm" {...attributes} {...listeners} className="cursor-grab">
            <GripVertical />
          </Button>
        </Col>
        <Col>
          <p className="fw-bold mb-0">{stop.name}</p>
          <p className="small text-muted mb-0">{stop.address}</p>
          {stop.remarks && <p className="small text-info mt-1 mb-0 fst-italic">"{stop.remarks}"</p>}
        </Col>
        <Col md={4} className="text-md-end">
          <Badge bg="light" text="dark" className="me-2">{displayWeekdays}</Badge>
          <Badge bg="secondary">{stop.arrival_time || 'Keine Zeit'}</Badge>
        </Col>
        <Col xs="auto">
          <Button variant="ghost" size="sm" onClick={onEdit}><Edit size={16} /></Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={onRemove}><Trash2 size={16} /></Button>
        </Col>
      </Row>
    </ListGroup.Item>
  );
};

const TourManagement = () => {
  const [selectedTourId, setSelectedTourId] = useState<number | null>(null);
  const [isAddTourDialogOpen, setIsAddTourDialogOpen] = useState(false);
  const [isEditStopDialogOpen, setIsEditStopDialogOpen] = useState(false);
  const [currentStop, setCurrentStop] = useState<RoutePoint | null>(null);
  const [tourName, setTourName] = useState('');
  const [tourType, setTourType] = useState('regulär');
  const [tourStops, setTourStops] = useState<RoutePoint[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor));

  const { data: tours, isLoading: isLoadingTours } = useQuery({ queryKey: ['tours'], queryFn: fetchTours });
  const { data: tourDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['tourDetails', selectedTourId],
    queryFn: () => fetchTourDetails(selectedTourId!),
    enabled: !!selectedTourId,
  });
  const { data: allStops, isLoading: isLoadingStops } = useQuery({ queryKey: ['tourStops'], queryFn: fetchTourStops });
  
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const tourVehicleGroupId = settings?.find(s => s.key === 'tour_planning_vehicle_group_id')?.value;

  const { data: availableVehicles, isLoading: isLoadingVehicles } = useQuery({
    queryKey: ['vehiclesByGroup', tourVehicleGroupId],
    queryFn: () => fetchVehiclesByGroup(tourVehicleGroupId ? Number(tourVehicleGroupId) : null),
    enabled: !!settings,
  });

  useEffect(() => {
    if (tourDetails) {
      setTourName(tourDetails.name);
      setTourStops(tourDetails.stops);
      setSelectedVehicleId(tourDetails.vehicle_id);
      setTourType(tourDetails.tour_type || 'regulär');
    }
  }, [tourDetails]);

  const createStopMutation = useMutation({
    mutationFn: async (newStop: { name: string; address: string }): Promise<TourStop> => {
      const { data, error } = await supabase.functions.invoke('action', { body: { action: 'create-tour-stop', payload: newStop } });
      if (error) throw error;
      return data.stop;
    },
    onSuccess: (newStop) => {
      queryClient.invalidateQueries({ queryKey: ['tourStops'] });
      const newRoutePoint: RoutePoint = {
        ...newStop,
        position: tourStops.length,
        route_point_id: Date.now(),
        weekdays: [1],
        arrival_time: '08:00',
        remarks: null,
      };
      setTourStops(prev => [...prev, newRoutePoint]);
      showSuccess("Neuer Stopp erstellt und zur Tour hinzugefügt.");
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen des Stopps."),
  });

  const updateStopMutation = useMutation({
    mutationFn: async (stop: RoutePoint) => {
      const { error } = await supabase.functions.invoke('action', { 
        body: {
          action: 'update-tour-stop',
          payload: {
            id: stop.id,
            route_point_id: stop.route_point_id,
            name: stop.name,
            address: stop.address,
            weekdays: stop.weekdays,
            arrival_time: stop.arrival_time,
            remarks: stop.remarks,
          }
        } 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Stopp-Details aktualisiert.");
      queryClient.invalidateQueries({ queryKey: ['tourDetails', selectedTourId] });
      queryClient.invalidateQueries({ queryKey: ['tourStops'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren des Stopps."),
  });

  const saveTourMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('action', {
        body: { 
          action: 'update-tour',
          payload: { id: selectedTourId, name: tourName, description: "", stops: tourStops, vehicle_id: selectedVehicleId, tour_type: tourType }
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tour erfolgreich gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['tourDetails', selectedTourId] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern der Tour."),
  });

  const deleteTourMutation = useMutation({
    mutationFn: async (tourId: number) => {
      const { error } = await supabase.functions.invoke('action', {
        body: { action: 'delete-tour', payload: { tourId } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tour erfolgreich gelöscht!");
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      setSelectedTourId(null);
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen der Tour."),
  });

  const handleSelectTour = (id: number) => setSelectedTourId(id);
  const handleAddStop = (selected: any) => {
    if (selected) {
      const stopToAdd = allStops?.find(s => s.id === selected.value);
      if (stopToAdd) {
        const newRoutePoint: RoutePoint = { ...stopToAdd, position: tourStops.length, route_point_id: Date.now(), weekdays: [1], arrival_time: '08:00', remarks: null };
        setTourStops(prev => [...prev, newRoutePoint]);
      }
    }
  };
  const handleCreateStop = (inputValue: string) => {
    const parts = inputValue.split(' - ');
    const name = parts[0];
    const address = parts.length > 1 ? parts.slice(1).join(' - ') : 'Bitte Adresse eintragen';
    createStopMutation.mutate({ name, address });
  };
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setTourStops((items) => {
        const oldIndex = items.findIndex(item => item.route_point_id === active.id);
        const newIndex = items.findIndex(item => item.route_point_id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  const handleEditStop = (stop: RoutePoint) => {
    setCurrentStop(stop);
    setIsEditStopDialogOpen(true);
  };
  const handleSaveStop = (updatedStop: RoutePoint) => {
    setTourStops(prev => prev.map(s => s.route_point_id === updatedStop.route_point_id ? updatedStop : s));
    updateStopMutation.mutate(updatedStop);
  };

  const stopOptions = allStops?.map(s => ({ value: s.id, label: `${s.name} - ${s.address}` })) || [];
  const vehicleOptions = availableVehicles?.map(v => ({ value: v.id, label: `${v.license_plate} (${v.brand} ${v.model})` })) || [];

  return (
    <>
      <Container fluid>
        <h1 className="h2 mb-4">Tourenverwaltung</h1>
        <Row>
          <Col md={4}>
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                Touren
                <Button variant="primary" size="sm" onClick={() => setIsAddTourDialogOpen(true)}><PlusCircle size={16} className="me-1" /> Neu</Button>
              </Card.Header>
              {isLoadingTours ? <Card.Body><Spinner size="sm" /></Card.Body> : (
                <ListGroup variant="flush">
                  {tours?.map(tour => (
                    <ListGroup.Item key={tour.id} action active={tour.id === selectedTourId} className="d-flex justify-content-between align-items-center">
                      <span onClick={() => handleSelectTour(tour.id)} className="flex-grow-1" style={{ cursor: 'pointer' }}>
                        {tour.name}
                        {tour.tour_type === 'bereitschaft' && <Badge bg="warning" text="dark" className="ms-2">Bereitschaft</Badge>}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-danger p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Sind Sie sicher, dass Sie die Tour "${tour.name}" löschen möchten?`)) {
                            deleteTourMutation.mutate(tour.id);
                          }
                        }}
                        disabled={deleteTourMutation.isPending && deleteTourMutation.variables === tour.id}
                      >
                        {deleteTourMutation.isPending && deleteTourMutation.variables === tour.id ? <Spinner size="sm" /> : <Trash2 size={16} />}
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card>
          </Col>
          <Col md={8}>
            <Card className="mb-4">
              <Card.Header><Card.Title>{selectedTourId ? 'Tour bearbeiten' : 'Bitte eine Tour auswählen'}</Card.Title></Card.Header>
              <Card.Body>
                {selectedTourId === null ? (
                  <div className="text-center text-muted p-5"><p>Bitte wählen Sie eine Tour aus der Liste aus oder erstellen Sie eine neue Tour.</p></div>
                ) : isLoadingDetails ? (
                  <div className="text-center p-5"><Spinner size="sm" /></div>
                ) : (
                  <>
                    <Row>
                      <Col md={6}><Form.Group className="mb-3"><Form.Label>Tourname</Form.Label><Form.Control value={tourName} onChange={e => setTourName(e.target.value)} /></Form.Group></Col>
                      <Col md={3}><Form.Group className="mb-3"><Form.Label>Art der Tour</Form.Label><Form.Select value={tourType} onChange={e => setTourType(e.target.value)}><option value="regulär">Reguläre Runde</option><option value="bereitschaft">Bereitschaftsrunde</option></Form.Select></Form.Group></Col>
                      <Col md={3}><Form.Group className="mb-3"><Form.Label>Fahrzeug</Form.Label><Form.Select value={selectedVehicleId ?? ''} onChange={e => setSelectedVehicleId(Number(e.target.value) || null)} disabled={isLoadingVehicles}><option value="">- Kein Fahrzeug -</option>{vehicleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</Form.Select></Form.Group></Col>
                    </Row>
                    <hr />
                    <h6>Stopps</h6>
                    <CreatableSelect isClearable options={stopOptions} isLoading={isLoadingStops || createStopMutation.isPending} onChange={handleAddStop} onCreateOption={handleCreateStop} placeholder="Stopp suchen oder neu anlegen..." formatCreateLabel={inputValue => `"${inputValue}" anlegen`} className="mb-3" />
                    <ListGroup>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={tourStops.map(s => s.route_point_id)} strategy={verticalListSortingStrategy}>
                          {tourStops.map((stop) => (
                            <SortableStopItem key={stop.route_point_id} stop={stop} onRemove={() => setTourStops(prev => prev.filter(s => s.route_point_id !== stop.route_point_id))} onEdit={() => handleEditStop(stop)} />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </ListGroup>
                  </>
                )}
              </Card.Body>
              {selectedTourId !== null && (
                <Card.Footer className="text-end">
                  <Button onClick={() => saveTourMutation.mutate()} disabled={!tourName || saveTourMutation.isPending}><Save size={16} className="me-1" /> {saveTourMutation.isPending ? 'Wird gespeichert...' : 'Tour speichern'}</Button>
                </Card.Footer>
              )}
            </Card>
            {selectedTourId !== null && (
              <Card>
                <Card.Header><Card.Title>Kartenansicht</Card.Title></Card.Header>
                <Card.Body className="p-0"><TourMap stops={tourStops} /></Card.Body>
              </Card>
            )}
          </Col>
        </Row>
      </Container>
      <AddTourDialog show={isAddTourDialogOpen} onHide={() => setIsAddTourDialogOpen(false)} onTourCreated={(tourId) => { setSelectedTourId(tourId); }} />
      <EditTourStopDialog show={isEditStopDialogOpen} onHide={() => setIsEditStopDialogOpen(false)} stop={currentStop} onSave={handleSaveStop} />
    </>
  );
};

export default TourManagement;