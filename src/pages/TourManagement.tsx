import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, ListGroup, Button, Form, Spinner } from 'react-bootstrap';
import { PlusCircle, Save, Trash2, GripVertical } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import type { Tour, TourStop, TourDetails } from '@/types/tour';
import CreatableSelect from 'react-select/creatable';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TourMap } from '@/components/tour/TourMap';
import { AddTourDialog } from '@/components/tour/AddTourDialog';

// API Functions
const fetchTours = async (): Promise<Tour[]> => {
  const { data, error } = await supabase.functions.invoke('get-tours');
  if (error) throw error;
  return data.tours;
};

const fetchTourDetails = async (tourId: number): Promise<TourDetails> => {
  const { data, error } = await supabase.functions.invoke('get-tour-details', { body: { tourId } });
  if (error) throw error;
  return data.tour;
};

const fetchTourStops = async (): Promise<TourStop[]> => {
  const { data, error } = await supabase.functions.invoke('get-tour-stops');
  if (error) throw error;
  return data.stops;
};

// Sortable Item Component
const SortableStopItem = ({ stop, onRemove }: { stop: TourStop, onRemove: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stop.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <ListGroup.Item ref={setNodeRef} style={style} className="d-flex align-items-center">
      <Button variant="ghost" size="sm" {...attributes} {...listeners} className="cursor-grab me-2">
        <GripVertical />
      </Button>
      <div className="flex-grow-1">
        <p className="fw-bold mb-0">{stop.name}</p>
        <p className="small text-muted mb-0">{stop.address}</p>
      </div>
      <Button variant="ghost" size="sm" className="text-danger" onClick={onRemove}>
        <Trash2 size={16} />
      </Button>
    </ListGroup.Item>
  );
};

const TourManagement = () => {
  const [selectedTourId, setSelectedTourId] = useState<number | null>(null);
  const [isAddTourDialogOpen, setIsAddTourDialogOpen] = useState(false);
  const [tourName, setTourName] = useState('');
  const [tourDescription, setTourDescription] = useState('');
  const [tourStops, setTourStops] = useState<TourStop[]>([]);
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor));

  const { data: tours, isLoading: isLoadingTours } = useQuery({ queryKey: ['tours'], queryFn: fetchTours });
  const { data: tourDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['tourDetails', selectedTourId],
    queryFn: () => fetchTourDetails(selectedTourId!),
    enabled: !!selectedTourId,
  });
  const { data: allStops, isLoading: isLoadingStops } = useQuery({ queryKey: ['tourStops'], queryFn: fetchTourStops });

  useEffect(() => {
    if (tourDetails) {
      setTourName(tourDetails.name);
      setTourDescription(tourDetails.description || '');
      setTourStops(tourDetails.stops);
    }
  }, [tourDetails]);

  const createStopMutation = useMutation({
    mutationFn: async (newStop: { name: string; address: string }): Promise<TourStop> => {
      const { data, error } = await supabase.functions.invoke('create-tour-stop', { body: newStop });
      if (error) throw error;
      return data.stop;
    },
    onSuccess: (newStop) => {
      queryClient.invalidateQueries({ queryKey: ['tourStops'] });
      setTourStops(prev => [...prev, newStop]);
      showSuccess("Neuer Stopp erstellt und zur Tour hinzugefügt.");
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen des Stopps."),
  });

  const saveTourMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('update-tour', {
        body: { id: selectedTourId, name: tourName, description: tourDescription, stops: tourStops },
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

  const handleSelectTour = (id: number) => {
    setSelectedTourId(id);
  };

  const handleAddStop = (selected: any) => {
    if (selected && !tourStops.some(s => s.id === selected.value)) {
      const stopToAdd = allStops?.find(s => s.id === selected.value);
      if (stopToAdd) {
        setTourStops(prev => [...prev, stopToAdd]);
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
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const stopOptions = allStops?.map(s => ({ value: s.id, label: `${s.name} - ${s.address}` })) || [];

  return (
    <>
      <Container fluid>
        <h1 className="h2 mb-4">Tourenverwaltung</h1>
        <Row>
          <Col md={4}>
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                Touren
                <Button variant="primary" size="sm" onClick={() => setIsAddTourDialogOpen(true)}>
                  <PlusCircle size={16} className="me-1" /> Neu
                </Button>
              </Card.Header>
              {isLoadingTours ? <Card.Body><Spinner size="sm" /></Card.Body> : (
                <ListGroup variant="flush">
                  {tours?.map(tour => (
                    <ListGroup.Item key={tour.id} action active={tour.id === selectedTourId} onClick={() => handleSelectTour(tour.id)}>
                      {tour.name}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card>
          </Col>
          <Col md={8}>
            <Card className="mb-4">
              <Card.Header>
                <Card.Title>{selectedTourId ? 'Tour bearbeiten' : 'Bitte eine Tour auswählen'}</Card.Title>
              </Card.Header>
              <Card.Body>
                {selectedTourId === null ? (
                  <div className="text-center text-muted p-5">
                    <p>Bitte wählen Sie eine Tour aus der Liste aus oder erstellen Sie eine neue Tour.</p>
                  </div>
                ) : isLoadingDetails ? (
                  <div className="text-center p-5"><Spinner size="sm" /></div>
                ) : (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>Tourname</Form.Label>
                      <Form.Control value={tourName} onChange={e => setTourName(e.target.value)} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Beschreibung</Form.Label>
                      <Form.Control as="textarea" value={tourDescription} onChange={e => setTourDescription(e.target.value)} />
                    </Form.Group>
                    <hr />
                    <h6>Stopps</h6>
                    <CreatableSelect
                      isClearable
                      options={stopOptions}
                      isLoading={isLoadingStops || createStopMutation.isPending}
                      onChange={handleAddStop}
                      onCreateOption={handleCreateStop}
                      placeholder="Stopp suchen oder neu anlegen..."
                      formatCreateLabel={inputValue => `"${inputValue}" anlegen`}
                      className="mb-3"
                    />
                    <ListGroup>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={tourStops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                          {tourStops.map(stop => (
                            <SortableStopItem key={stop.id} stop={stop} onRemove={() => setTourStops(prev => prev.filter(s => s.id !== stop.id))} />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </ListGroup>
                  </>
                )}
              </Card.Body>
              {selectedTourId !== null && (
                <Card.Footer className="text-end">
                  <Button onClick={() => saveTourMutation.mutate()} disabled={!tourName || saveTourMutation.isPending}>
                    <Save size={16} className="me-1" /> {saveTourMutation.isPending ? 'Wird gespeichert...' : 'Tour speichern'}
                  </Button>
                </Card.Footer>
              )}
            </Card>
          </Card>
          {selectedTourId !== null && (
            <Card>
              <Card.Header>
                <Card.Title>Kartenansicht</Card.Title>
              </Card.Header>
              <Card.Body className="p-0">
                <TourMap stops={tourStops} />
              </Card.Body>
            </Card>
          )}
        </Col>
        </Row>
      </Container>
      <AddTourDialog
        show={isAddTourDialogOpen}
        onHide={() => setIsAddTourDialogOpen(false)}
        onTourCreated={(tourId) => {
          setSelectedTourId(tourId);
        }}
      />
    </>
  );
};

export default TourManagement;