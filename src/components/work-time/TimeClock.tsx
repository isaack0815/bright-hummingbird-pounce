import { useState, useEffect } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { PlayCircle, StopCircle } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { de } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Vehicle } from '@/types/vehicle';
import { ClockInOutModal } from './ClockInOutModal';

type WorkSession = {
  id: number;
  start_time: string;
};

type TimeClockProps = {
  status: WorkSession | null;
  isLoading: boolean;
  onClockIn: (payload?: { start_km?: number }) => void;
  onClockOut: (payload?: { end_km?: number; notes?: string }) => void;
  isMutating: boolean;
};

const fetchAssignedVehicle = async (): Promise<Vehicle | null> => {
    const { data, error } = await supabase.functions.invoke('action', {
        body: { action: 'get-user-vehicle-assignment' }
    });
    if (error) throw error;
    return data.vehicle;
}

export const TimeClock = ({ status, isLoading, onClockIn, onClockOut, isMutating }: TimeClockProps) => {
  const [elapsedTime, setElapsedTime] = useState('');
  const [showModal, setShowModal] = useState<'in' | 'out' | null>(null);

  const { data: assignedVehicle } = useQuery({
    queryKey: ['assignedVehicle'],
    queryFn: fetchAssignedVehicle,
  });

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

  if (isLoading) {
    return <Spinner size="sm" />;
  }

  return (
    <>
      <div className="d-flex align-items-center gap-3">
        {status ? (
          <>
            <div className="text-end">
              <span className="text-success small">Eingestempelt</span>
              <div className="fw-bold">{elapsedTime}</div>
            </div>
            <Button variant="danger" size="sm" onClick={handleClockOut} disabled={isMutating}>
              <StopCircle size={16} />
            </Button>
          </>
        ) : (
          <>
            <div className="text-end">
              <span className="text-muted small">Ausgestempelt</span>
              <div className="fw-bold text-muted">--:--:--</div>
            </div>
            <Button variant="success" size="sm" onClick={handleClockIn} disabled={isMutating}>
              <PlayCircle size={16} />
            </Button>
          </>
        )}
      </div>
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