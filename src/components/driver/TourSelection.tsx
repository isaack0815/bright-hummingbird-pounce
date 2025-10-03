import { Card, ListGroup } from 'react-bootstrap';
import { ChevronRight } from 'lucide-react';

type Stop = {
  completed_at: string | null;
};

type Tour = {
  id: number;
  name: string;
  stops: Stop[];
};

type TourSelectionProps = {
  tours: Tour[];
  onSelectTour: (tour: Tour) => void;
};

export const TourSelection = ({ tours, onSelectTour }: TourSelectionProps) => {
  if (tours.length === 0) {
    return (
      <div className="text-center text-muted p-5">
        <p>Für heute ist keine Tour zugewiesen.</p>
      </div>
    );
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title as="h6">Bitte wählen Sie Ihre Tour</Card.Title>
      </Card.Header>
      <ListGroup variant="flush">
        {tours.map(tour => {
          const totalStops = tour.stops.length;
          const completedStops = tour.stops.filter(s => s.completed_at).length;
          const remainingStops = totalStops - completedStops;

          return (
            <ListGroup.Item key={tour.id} action onClick={() => onSelectTour(tour)} className="d-flex justify-content-between align-items-center">
              <div>
                <p className="fw-bold mb-0">{tour.name}</p>
                <p className="small text-muted mb-0">
                  {remainingStops > 0 ? `${remainingStops} von ${totalStops} Stopps offen` : 'Alle Stopps erledigt'}
                </p>
              </div>
              <ChevronRight />
            </ListGroup.Item>
          );
        })}
      </ListGroup>
    </Card>
  );
};