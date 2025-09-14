import { useState, useEffect } from 'react';
import { Card, Button, Spinner } from 'react-bootstrap';
import { PlayCircle, StopCircle } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { de } from 'date-fns/locale';

type WorkSession = {
  id: number;
  start_time: string;
};

type TimeClockProps = {
  status: WorkSession | null;
  isLoading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  isMutating: boolean;
};

export const TimeClock = ({ status, isLoading, onClockIn, onClockOut, isMutating }: TimeClockProps) => {
  const [elapsedTime, setElapsedTime] = useState('');

  useEffect(() => {
    let intervalId: number;
    if (status) {
      const updateElapsedTime = () => {
        const elapsed = formatDistanceToNowStrict(new Date(status.start_time), { locale: de });
        setElapsedTime(elapsed);
      };
      updateElapsedTime();
      intervalId = setInterval(updateElapsedTime, 1000);
    }
    return () => clearInterval(intervalId);
  }, [status]);

  if (isLoading) {
    return <Card.Body className="text-center"><Spinner size="sm" /></Card.Body>;
  }

  return (
    <Card.Body className="d-flex flex-column align-items-center justify-content-center text-center">
      {status ? (
        <>
          <h5 className="text-success">Eingestempelt</h5>
          <p className="display-6 fw-bold">{elapsedTime}</p>
          <Button variant="danger" onClick={onClockOut} disabled={isMutating}>
            <StopCircle className="me-2" />
            {isMutating ? 'Wird gestoppt...' : 'Ausstempeln'}
          </Button>
        </>
      ) : (
        <>
          <h5 className="text-muted">Ausgestempelt</h5>
          <p className="display-6 text-muted">--:--:--</p>
          <Button variant="success" onClick={onClockIn} disabled={isMutating}>
            <PlayCircle className="me-2" />
            {isMutating ? 'Wird gestartet...' : 'Einstempeln'}
          </Button>
        </>
      )}
    </Card.Body>
  );
};