import { Container, Spinner, Alert } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DriverTimeClock } from '@/components/driver/DriverTimeClock';
import { CurrentTour } from '@/components/driver/CurrentTour';
import { showError } from '@/utils/toast';

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

const DriverDashboard = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['driverDashboardData'],
    queryFn: fetchDashboardData,
  });

  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string, payload?: any }) => manageWorkTime(action, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverDashboardData'] });
    },
    onError: (err: any) => showError(err.message || "Ein Fehler ist aufgetreten."),
  });

  if (isLoading) {
    return <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}><Spinner /></div>;
  }

  if (error) {
    return <Alert variant="danger">Fehler beim Laden der Daten: {error.message}</Alert>;
  }

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
          assignedVehicle={null} // Vehicle logic can be added later if needed
        />
        <CurrentTour tours={data.tours || []} />
      </div>
    </Container>
  );
};

export default DriverDashboard;