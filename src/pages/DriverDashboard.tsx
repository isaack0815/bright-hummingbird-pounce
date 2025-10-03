import { useState, useEffect } from 'react';
import { Container, Spinner, Alert, Button, Card, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DriverTimeClock } from '@/components/driver/DriverTimeClock';
import { CurrentTour } from '@/components/driver/CurrentTour';
import { TourSelection } from '@/components/driver/TourSelection';
import { showError, showSuccess } from '@/utils/toast';
import type { Vehicle } from '@/types/vehicle';
import { useGeolocation } from '@/hooks/use-geolocation';
import { ShieldAlert, ArrowLeft, HeartPulse } from 'lucide-react';

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

const fetchDashboardData = async () => {
  const { data, error } = await supabase.functions.invoke('get-driver-dashboard-data');
  if (error) throw new Error(error.message);
  return data;
};

const manageWorkTime = async (action: string, payload: any = {}) => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action, payload },
  });
  if (error) throw error;
  return data;
};

const fetchAssignedVehicle = async (): Promise<Vehicle | null> => {
    const { data, error } = await supabase.functions.invoke('action', {
        body: { action: 'get-user-vehicle-assignment' }
    });
    if (error) throw error;
    return data.vehicle;
}

const DriverDashboard = () => {
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const queryClient = useQueryClient();
  const { permissionState, getCurrentPosition } = useGeolocation();

  useEffect(() => {
    if (permissionState === 'prompt') {
      getCurrentPosition().catch(() => {});
    }
  }, [permissionState, getCurrentPosition]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['driverDashboardData'],
    queryFn: fetchDashboardData,
  });

  const { data: assignedVehicle, isLoading: isLoadingVehicle } = useQuery({
    queryKey: ['assignedVehicle'],
    queryFn: fetchAssignedVehicle,
  });

  const workTimeMutation = useMutation({
    mutationFn: ({ action, payload }: { action: string, payload?: any }) => manageWorkTime(action, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverDashboardData'] });
    },
    onError: (err: any) => showError(err.message || "Ein Fehler ist aufgetreten."),
  });

  const reportSickMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('report-sick');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message);
    },
    onError: (err: any) => {
      showError(err.data?.error || err.message || "Fehler beim Senden der Krankmeldung.");
    },
  });

  if (isLoading || isLoadingVehicle) {
    return <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}><Spinner /></div>;
  }

  if (error) {
    return <Alert variant="danger">Fehler beim Laden der Daten: {error.message}</Alert>;
  }

  const isGpsGranted = permissionState === 'granted';

  return (
    <Container>
      <div className="d-flex align-items-center gap-3 mb-4">
        {selectedTour && (
          <Button variant="outline-secondary" size="sm" className="p-2 lh-1" onClick={() => setSelectedTour(null)}>
            <ArrowLeft size={16} />
          </Button>
        )}
        <h1 className="h2 mb-0">
          {selectedTour ? `Tour: ${selectedTour.name}` : 'Fahrer-Dashboard'}
        </h1>
      </div>
      <div className="d-flex flex-column gap-4">
        <DriverTimeClock
          status={data.workSession}
          isLoading={isLoading}
          onClockIn={(payload) => workTimeMutation.mutate({ action: 'clock-in', payload })}
          onClockOut={(payload) => workTimeMutation.mutate({ action: 'clock-out', payload })}
          isMutating={workTimeMutation.isPending}
          assignedVehicle={assignedVehicle || null}
        />
        
        <Card>
          <Card.Body className="d-flex justify-content-center">
            <Button 
              variant="outline-danger" 
              onClick={() => reportSickMutation.mutate()}
              disabled={reportSickMutation.isPending}
            >
              <HeartPulse className="me-2" />
              {reportSickMutation.isPending ? 'Wird gesendet...' : 'Krankmeldung'}
            </Button>
          </Card.Body>
        </Card>

        {permissionState !== 'granted' && (
          <Alert variant="warning" className="d-flex align-items-center">
            <ShieldAlert className="me-3" size={40} />
            <div>
              <Alert.Heading>Standortfreigabe erforderlich</Alert.Heading>
              {permissionState === 'denied' ? (
                <p className="mb-0">
                  Der Standortzugriff wurde blockiert. Bitte ändern Sie die Berechtigung in den Einstellungen Ihres Browsers, um die Tour-Funktionen nutzen zu können.
                </p>
              ) : (
                <p className="mb-0">
                  Um Ihre Tour zu bearbeiten, müssen Sie dieser App den Zugriff auf Ihren Standort erlauben. Bitte bestätigen Sie die Anfrage Ihres Browsers.
                </p>
              )}
            </div>
          </Alert>
        )}

        {selectedTour ? (
          <CurrentTour 
            tours={[selectedTour]}
            isGpsGranted={isGpsGranted}
            getCurrentPosition={getCurrentPosition}
          />
        ) : (
          <TourSelection 
            tours={data.tours || []}
            onSelectTour={setSelectedTour}
          />
        )}
      </div>
    </Container>
  );
};

export default DriverDashboard;