import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, Spinner, Button, ListGroup, Badge } from 'react-bootstrap';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { DayPicker } from 'react-day-picker';
import { de } from 'date-fns/locale';
import { format } from 'date-fns';
import type { Tour, TourStop } from '@/types/tour';
import { showSuccess } from '@/utils/toast';

const fetchTours = async (): Promise<Tour[]> => {
  const { data, error } = await supabase.functions.invoke('get-tours');
  if (error) throw error;
  return data.tours;
};

const fetchAllStops = async (): Promise<TourStop[]> => {
  const { data, error } = await supabase.functions.invoke('get-tour-stops');
  if (error) throw error;
  return data.stops;
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
    <Card className="h-100">
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

  const { data: tours, isLoading: isLoadingTours } = useQuery({ queryKey: ['tours'], queryFn: fetchTours });
  const { data: allStops, isLoading: isLoadingStops } = useQuery({ queryKey: ['allStops'], queryFn: fetchAllStops });

  useEffect(() => {
    if (allStops) {
      setAvailableStops(allStops);
    }
  }, [allStops]);

  useEffect(() => {
    if (tours) {
      const initialAssignments: Record<number, TourStop[]> = {};
      tours.forEach(tour => {
        initialAssignments[tour.id] = [];
      });
      setAssignedStops(initialAssignments);
    }
  }, [tours]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    if (!over) return;

    const stop = active.data.current?.stop as TourStop;
    if (!stop) return;

    const dropTargetId = String(over.id);

    // Find where the stop currently is
    let stopSource: 'unassigned' | number = 'unassigned';
    let stopIndex = availableStops.findIndex(s => s.id === stop.id);

    if (stopIndex === -1) {
      for (const tourId in assignedStops) {
        const index = assignedStops[tourId].findIndex(s => s.id === stop.id);
        if (index !== -1) {
          stopSource = Number(tourId);
          stopIndex = index;
          break;
        }
      }
    }

    if (stopIndex !== -1) {
      const newAvailable = [...availableStops];
      const newAssigned = JSON.parse(JSON.stringify(assignedStops));

      // Remove from source
      if (stopSource === 'unassigned') {
        newAvailable.splice(stopIndex, 1);
      } else {
        newAssigned[stopSource].splice(stopIndex, 1);
      }

      // Add to destination
      if (dropTargetId === 'unassigned') {
        newAvailable.push(stop);
      } else {
        const tourId = Number(dropTargetId.replace('tour-', ''));
        if (!newAssigned[tourId]) newAssigned[tourId] = [];
        newAssigned[tourId].push(stop);
      }

      setAvailableStops(newAvailable);
      setAssignedStops(newAssigned);
    }
  };

  const isLoading = isLoadingTours || isLoadingStops;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h2">Disposition für {format(selectedDate, 'PPP', { locale: de })}</h1>
          <Button variant="primary" disabled>Tagesplanung speichern (in Kürze)</Button>
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