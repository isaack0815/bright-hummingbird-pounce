import { Accordion } from 'react-bootstrap';
import { StopItem } from './StopItem';

type Stop = {
  id: number;
  name: string;
  address: string;
  assignment_id: number;
  started_at: string | null;
  completed_at: string | null;
};

type Tour = {
  id: number;
  name: string;
  stops: Stop[];
};

type CurrentTourProps = {
  tours: Tour[];
  isGpsGranted: boolean;
  getCurrentPosition: () => Promise<{ lat: number; lon: number }>;
};

export const CurrentTour = ({ tours, isGpsGranted, getCurrentPosition }: CurrentTourProps) => {
  if (tours.length === 0) {
    return (
      <div className="text-center text-muted p-5">
        <p>Für heute ist keine Tour zugewiesen.</p>
      </div>
    );
  }

  return (
    <Accordion defaultActiveKey={tours[0].id.toString()} alwaysOpen>
      {tours.map(tour => {
        const activeStops = tour.stops.filter(s => !s.completed_at);
        return (
          <Accordion.Item eventKey={tour.id.toString()} key={tour.id}>
            <Accordion.Header>{tour.name}</Accordion.Header>
            <Accordion.Body>
              {activeStops.map((stop, index) => (
                <StopItem 
                  key={stop.id} 
                  stop={stop} 
                  isNext={index === 0}
                  isGpsGranted={isGpsGranted}
                  getCurrentPosition={getCurrentPosition}
                />
              ))}
              {activeStops.length === 0 && (
                <p className="text-center text-success p-3">Alle Stopps für diese Tour sind erledigt!</p>
              )}
            </Accordion.Body>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
};