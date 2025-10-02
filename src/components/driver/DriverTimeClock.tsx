import { useState, useEffect } from 'react';
import { Button, Card, Spinner } from 'react-bootstrap';
import { PlayCircle, StopCircle } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { de } from 'date-fns/locale';
import { ClockInOutModal } from '@/components/work-time/ClockInOutModal';
import type { Vehicle } from '@/types/vehicle';

type WorkSession = {
  id: number;
  start_time: string;
};

type DriverTimeClockProps = {
  status: WorkSession | null;
  isLoading: boolean;
  onClockIn: (payload?: { start_km?: number }) => void;
  onClockOut: (payload?: { end_km?: number; notes?: string }) => void;
  isMutating: boolean;
  assignedVehicle: Vehicle | null;
};

export const DriverTimeClock = ({ status, isLoading, onClockIn, onClockOut, isMutating, assignedVehicle }: DriverTimeClockProps) => {
  const [elapsedTime, setElapsedTime] = useState('');
  const [showModal, setShowModal] = useState<'in' | 'out' | null>(null);

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

  const handleClockIn = () => {
    if (assignedVehicle) {
      setShowModal('in');
    } else {
      onClockIn();
    }
  };

  const handleClockOut = () => {
    setShowModal('out');
  };

  const handleModalSubmit = (payload: { kilometers?: number; notes?: string }) => {
    if (showModal === 'in') {
      onClockIn({ start_km: payload.kilometers });
    } else {
      onClockOut({ end_km: payload.kilometers, notes: payload.notes });
    }
  };

  return (
    <>
      <Card>
        <Card.Body className="d-flex justify-content-between align-items-center">
          {isLoading ? <Spinner size="sm" /> : (
            status ? (
              <>
                <div>
                  <p className="mb-0 text-success">Dienst aktiv seit:</p>
                  <p className="h5 mb-0">{elapsedTime}</p>
                </div>
                <Button variant="danger" onClick={handleClockOut} disabled={isMutating}>
                  <StopCircle className="me-2" /> Dienst beenden
                </Button>
              </>
            ) : (
              <>
                <div>
                  <p className="mb-0 text-muted">Dienst beendet</p>
                  <p className="h5 mb-0 text-muted">--:--:--</p>
                </div>
                <Button variant="success" onClick={handleClockIn} disabled={isMutating}>
                  <PlayCircle className="me-2" /> Dienst beginnen
                </Button>
              </>
            )
          )}
        </Card.Body>
      </Card>
      <ClockInOutModal
        show={!!showModal}
        onHide={() => setShowModal(null)}
        type={showModal!}
        vehicle={assignedVehicle || null}
        onSubmit={handleModalSubmit}
        isMutating={isMutating}
      />
    </>
  );
};