import { Card, Button, Badge } from 'react-bootstrap';
import { MapPin, CheckCircle2, Truck, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showError } from '@/utils/toast';

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
};

export const StopItem = ({ stop, isNext }: StopItemProps) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (status: 'start' | 'complete') => {
      const { error } = await supabase.functions.invoke('update-dispatch-stop-status', {
        body: { assignmentId: stop.assignment_id, status },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverDashboardData'] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Aktualisieren des Status.");
    },
  });

  const status = stop.completed_at ? 'completed' : stop.started_at ? 'in_progress' : 'pending';

  return (
    <Card className={`mb-3 ${isNext && status === 'pending' ? 'border-primary' : ''}`}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <Card.Title as="h6">{stop.name}</Card.Title>
            <Card.Text className="text-muted small">{stop.address}</Card.Text>
          </div>
          {status === 'completed' && <Badge bg="success"><CheckCircle2 size={14} className="me-1" /> Erledigt</Badge>}
          {status === 'in_progress' && <Badge bg="warning">Wird bearbeitet</Badge>}
        </div>
        <div className="d-flex gap-2 mt-3">
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={() => mutation.mutate('start')}
            disabled={status !== 'pending' || mutation.isPending}
          >
            {mutation.isPending && mutation.variables === 'start' ? <Loader2 className="animate-spin" /> : <MapPin size={16} className="me-2" />}
            Ankunft
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => mutation.mutate('complete')}
            disabled={status !== 'in_progress' || mutation.isPending}
          >
            {mutation.isPending && mutation.variables === 'complete' ? <Loader2 className="animate-spin" /> : <Truck size={16} className="me-2" />}
            Abfahrt
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};