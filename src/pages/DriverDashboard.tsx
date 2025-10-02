import { Container, Spinner, Alert } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DriverTimeClock } from '@/components/driver/DriverTimeClock';
import { CurrentTour } from '@/components/driver/CurrentTour';
import { showError } from '@/utils/toast';
import type { Vehicle } from '@/types/vehicle';
import { useGeolocation } from '@/hooks/use-geolocation';
import { ShieldAlert } from 'lucide-react';

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
  const queryClient = useQueryClient();
  const { permissionState, getCurrentPosition } = useGeolocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ['driverDashboardData'],
    queryFn: fetchDashboardData,
  });

  const { data: assignedVehicle, isLoading: isLoadingVehicle } = useQuery({
    queryKey: ['assignedVehicle'],
    queryFn: fetchAssignedVehicle,
  });

  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string, payload?: any }) => manageWorkTime(action, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverDashboardData'] });
    },
    onError: (err: any) => showError(err.message || "Ein Fehler ist aufgetreten."),
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
      <h1 className="h2 mb-4">Fahrer-Dashboard</h1>
      <div className="d-flex flex-column gap-4">
        <DriverTimeClock
          status={data.workSession}
          isLoading={isLoading}
          onClockIn={(payload) => mutation.mutate({ action: 'clock-in', payload })}
          onClockOut={(payload) => mutation.mutate({ action: 'clock-out', payload })}
          isMutating={mutation.isPending}
          assignedVehicle={assignedVehicle || null}
        />
        
        {!isGpsGranted && (
          <Alert variant="warning" className="d-flex align-items-center">
            <ShieldAlert className="me-3" size={40} />
            <div>
              <Alert.Heading>Standortfreigabe erforderlich</Alert.Heading>
              <p className="mb-0">
                Um Ihre Tour zu bearbeiten, müssen Sie dieser App den Zugriff auf Ihren Standort erlauben. Bitte aktivieren Sie die Standortermittlung in den Einstellungen Ihres Browsers für diese Seite.
              </p>
            </div>
          </Alert>
        )}

        <CurrentTour 
          tours={data.tours || []} 
          isGpsGranted={isGpsGranted}
          getCurrentPosition={getCurrentPosition}
        />
      </div>
    </Container>
  );
};

export default DriverDashboard;