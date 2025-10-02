import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, Spinner, Button, ListGroup } from 'react-bootstrap';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { DayPicker } from 'react-day-picker';
import { de } from 'date-fns/locale';
import { format } from 'date-fns';
import type { Tour, TourStop } from '@/types/tour';
import { showSuccess, showError } from '@/utils/toast';

const fetchTours = async (): Promise<Tour[]> => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action: 'get-tours' }
  });
  if (error) throw error;
  return data.tours;
};

const fetchAllStops = async (): Promise<TourStop[]> => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action: 'get-tour-stops' }
  });
  if (error) throw error;
  return data.stops;
};

const fetchAssignments = async (date: string): Promise<{ tour_id: number, stop_id: number }[]> => {
    const { data, error } = await supabase.functions.invoke('manage-dispatch', {
        body: { action: 'get-assignments-for-date', payload: { date } }
    });
    if (error) throw error;
    return data.assignments || [];
};

function DraggableStop({ stop }: { stop: TourStop }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `stop-${stop.id}`,
    data: { stop },
  });
  
  return (
    <ListGroup.Item ref={setNodeRef} {...listeners} {...attributes} className="mb-2 shadow-sm" style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}>
      <p className="fw-bold mb-0">{stop.name}</p>
      <p className="small text-muted mb-0">{stop.address}</p>
    </ListGroup.Item>
  );
}

function DroppableArea({ id, children, title }: { id: string, children: React.ReactNode, title: string }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const style = {
    backgroundColor: isOver ? '#e9ecef' : '#f8f9fa',
    minHeight: '200px',
    transition: 'background-color 0.2s ease',
  };
  return (
    <Card className="h-100 mb-3">
      <Card.Header>{title}</Card.Header>
      <Card.Body ref={setNodeRef} style={style} className="p-2">
        {children}
      </Card.Body>
    </Card>
  );
}

const Dispatch = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableStops, setAvailableStops] = useState<TourStop[]>([]);
  const [assignedStops, setAssignedStops] = useState<Record<number, TourStop[]>>({});
  const queryClient = useQueryClient();

  const { data: tours, isLoading: isLoadingTours } = useQuery({ queryKey: ['tours'], queryFn: fetchTours });
  const { data: allStops, isLoading: isLoadingStops } = useQuery({ queryKey: ['allStops'], queryFn: fetchAllStops });

  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const { data: dailyAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['dispatchAssignments', formattedDate],
    queryFn: () => fetchAssignments(formattedDate),
  });

  useEffect(() => {
    if (allStops && tours && dailyAssignments) {
      const allStopsMap = new Map(allStops.map(s => [s.id, s]));
      const assignedStopIds = new Set(dailyAssignments.map(a => a.stop_id));
      
      const newAvailable = allStops.filter(s => !assignedStopIds.has(s.id));
      setAvailableStops(newAvailable);

      const newAssigned: Record<number, TourStop[]> = {};
      tours.forEach(tour => {
        newAssigned[tour.id] = [];
      });

      dailyAssignments.forEach(assignment => {
        const stop = allStopsMap.get(assignment.stop_id);
        if (stop && newAssigned[assignment.tour_id]) {
          newAssigned[assignment.tour_id].push(stop);
        }
      });

      setAssignedStops(newAssigned);
    } else if (allStops && tours) {
        setAvailableStops(allStops);
        const initialAssignments: Record<number, TourStop[]> = {};
        tours.forEach(tour => {
            initialAssignments[tour.id] = [];
        });
        setAssignedStops(initialAssignments);
    }
  }, [allStops, tours, dailyAssignments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const assignmentsToSave: Record<number, number[]> = {};
      for (const tourId in assignedStops) {
        assignmentsToSave[tourId] = assignedStops[tourId].map(stop => stop.id);
      }
      const { error } = await supabase.functions.invoke('manage-dispatch', {
        body: {
          action: 'save-assignments-for-date',
          payload: { date: formattedDate, assignments: assignmentsToSave }
        }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(`Tagesplanung für ${format(selectedDate, 'PPP', { locale: de })} gespeichert!`);
      queryClient.invalidateQueries({ queryKey: ['dispatchAssignments', formattedDate] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Speichern.");
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    if (!over) return;

    const stop = active.data.current?.stop as TourStop;
    if (!stop) return;

    const dropTargetId = String(over.id);

    // Remove from wherever it was
    setAvailableStops(prev => prev.filter(s => s.id !== stop.id));
    setAssignedStops(prev => {
        const newAssigned = { ...prev };
        for (const tourId in newAssigned) {
            newAssigned[tourId] = newAssigned[tourId].filter((s: TourStop) => s.id !== stop.id);
        }
        return newAssigned;
    });

    // Add to new location
    if (dropTargetId === 'unassigned') {
        setAvailableStops(prev => [...prev, stop]);
    } else if (dropTargetId.startsWith('tour-')) {
        const tourId = Number(dropTargetId.replace('tour-', ''));
        setAssignedStops(prev => ({
            ...prev,
            [tourId]: [...(prev[tourId] || []), stop]
        }));
    }
  };

  const isLoading = isLoadingTours || isLoadingStops || isLoadingAssignments;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h2">Disposition für {format(selectedDate, 'PPP', { locale: de })}</h1>
          <Button variant="primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Spinner as="span" size="sm" className="me-2" /> : null}
            {saveMutation.isPending ? 'Wird gespeichert...' : 'Tagesplanung speichern'}
          </Button>
        </div>
        <Row className="g-4">
          <Col md={4}>
            <Card>
              <Card.Header>Datum auswählen</Card.Header>
              <Card.Body className="d-flex justify-content-center">
                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={de}
                />
              </Card.Body>
            </Card>
            <div className="mt-4">
              <DroppableArea id="unassigned" title={`Verfügbare Stopps (${availableStops.length})`}>
                {isLoading ? <Spinner size="sm" /> : (
                  <ListGroup variant="flush" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                    {availableStops.map(stop => <DraggableStop key={stop.id} stop={stop} />)}
                  </ListGroup>
                )}
              </DroppableArea>
            </div>
          </Col>
          <Col md={8}>
            <Card>
              <Card.Header>Touren</Card.Header>
              <Card.Body style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                {isLoading ? <Spinner /> : (
                  tours?.map(tour => (
                    <DroppableArea key={tour.id} id={`tour-${tour.id}`} title={`${tour.name} (${assignedStops[tour.id]?.length || 0} Stopps)`}>
                      <ListGroup variant="flush">
                        {(assignedStops[tour.id] || []).map(stop => (
                          <DraggableStop key={stop.id} stop={stop} />
                        ))}
                      </ListGroup>
                    </DroppableArea>
                  ))
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </DndContext>
  );
};

export default Dispatch;