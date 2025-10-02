import { Card, Button, Badge } from 'react-bootstrap';
import { Map, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/utils/toast';

type Stop = {
  id: number;
  name: string;
  address: string;
  assignment_id: number;
  started_at: string | null;
  completed_at: string | null;
};

type StopItemProps = {
  stop: Stop;
  isNext: boolean;
  isGpsGranted: boolean;
  getCurrentPosition: () => Promise<{ lat: number; lon: number }>;
};

export const StopItem = ({ stop, isNext, isGpsGranted, getCurrentPosition }: StopItemProps) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ status, latitude, longitude }: { status: 'completed' | 'failed', latitude: number, longitude: number }) => {
      const { error } = await supabase.functions.invoke('update-dispatch-stop-status', {
        body: { assignmentId: stop.assignment_id, status, latitude, longitude },
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      showSuccess(`Stopp als "${variables.status === 'completed' ? 'Erledigt' : 'Ausgefallen'}" markiert.`);
      queryClient.invalidateQueries({ queryKey: ['driverDashboardData'] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Aktualisieren des Status.");
    },
  });

  const handleNavigation = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`;
    window.open(url, '_blank');
  };

  const handleStatusUpdate = async (status: 'completed' | 'failed') => {
    if (!isGpsGranted) {
      showError("Bitte erteilen Sie die Standortfreigabe, um fortzufahren.");
      return;
    }
    try {
      const { lat, lon } = await getCurrentPosition();
      mutation.mutate({ status, latitude: lat, longitude: lon });
    } catch (error) {
      showError("Standort konnte nicht ermittelt werden. Bitte versuchen Sie es erneut.");
      console.error(error);
    }
  };

  return (
    <Card className={`mb-3 ${isNext ? 'border-primary' : ''}`}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <Card.Title as="h6">{stop.name}</Card.Title>
            <Card.Text className="text-muted small">{stop.address}</Card.Text>
          </div>
        </div>
        <div className="d-flex gap-2 mt-3">
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={handleNavigation}
          >
            <Map size={16} className="me-2" />
            Navigation
          </Button>
          <Button 
            variant="success" 
            size="sm" 
            onClick={() => handleStatusUpdate('completed')}
            disabled={!isGpsGranted || mutation.isPending}
          >
            {mutation.isPending && mutation.variables?.status === 'completed' ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={16} className="me-2" />}
            Erledigt
          </Button>
          <Button 
            variant="danger" 
            size="sm" 
            onClick={() => handleStatusUpdate('failed')}
            disabled={!isGpsGranted || mutation.isPending}
          >
            {mutation.isPending && mutation.variables?.status === 'failed' ? <Loader2 className="animate-spin" /> : <XCircle size={16} className="me-2" />}
            Ausgefallen
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};