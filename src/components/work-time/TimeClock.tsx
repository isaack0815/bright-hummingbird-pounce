import { useState, useEffect } from 'react';
import { Button, Spinner } from 'react-bootstrap';
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
    return <Spinner size="sm" />;
  }

  return (
    <div className="d-flex align-items-center gap-3">
      {status ? (
        <>
          <div className="text-end">
            <span className="text-success small">Eingestempelt</span>
            <div className="fw-bold">{elapsedTime}</div>
          </div>
          <Button variant="danger" size="sm" onClick={onClockOut} disabled={isMutating}>
            <StopCircle size={16} />
          </Button>
        </>
      ) : (
        <>
          <div className="text-end">
            <span className="text-muted small">Ausgestempelt</span>
            <div className="fw-bold text-muted">--:--:--</div>
          </div>
          <Button variant="success" size="sm" onClick={onClockIn} disabled={isMutating}>
            <PlayCircle size={16} />
          </Button>
        </>
      )}
    </div>
  );
};