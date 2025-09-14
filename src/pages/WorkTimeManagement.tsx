import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Row, Col, Spinner } from 'react-bootstrap';
import { TimeClock } from '@/components/work-time/TimeClock';
import { WorkTimeHistory } from '@/components/work-time/WorkTimeHistory';
import { EditWorkTimeDialog } from '@/components/work-time/EditWorkTimeDialog';
import { showError, showSuccess } from '@/utils/toast';

type WorkSession = {
  id: number;
  start_time: string;
  end_time: string | null;
  break_duration_minutes: number;
  notes: string | null;
};

const manageWorkTime = async (action: string, payload: any = {}) => {
  const { data, error } = await supabase.functions.invoke('manage-work-time', {
    body: { action, payload },
  });
  if (error) throw error;
  return data;
};

const WorkTimeManagement = () => {
  const [editSession, setEditSession] = useState<WorkSession | null>(null);
  const queryClient = useQueryClient();

  const { data: statusData, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['workTimeStatus'],
    queryFn: () => manageWorkTime('get-status'),
  });

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['workTimeHistory'],
    queryFn: () => manageWorkTime('get-history'),
  });

  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string, payload?: any }) => manageWorkTime(action, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTimeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['workTimeHistory'] });
      setEditSession(null);
    },
    onError: (err: any) => showError(err.message || "Ein Fehler ist aufgetreten."),
  });

  const handleSave = (id: number, data: any) => {
    mutation.mutate({ action: 'update', payload: { id, ...data } });
    showSuccess("Eintrag gespeichert!");
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Möchten Sie diesen Zeiteintrag wirklich löschen?")) {
      mutation.mutate({ action: 'delete', payload: { id } });
      showSuccess("Eintrag gelöscht!");
    }
  };

  return (
    <>
      <h1 className="h2 mb-4">Zeiterfassung</h1>
      <Row className="g-4">
        <Col lg={4}>
          <Card className="h-100">
            <Card.Header><Card.Title>Stempeluhr</Card.Title></Card.Header>
            <TimeClock
              status={statusData?.status}
              isLoading={isLoadingStatus}
              onClockIn={() => mutation.mutate({ action: 'clock-in' })}
              onClockOut={() => mutation.mutate({ action: 'clock-out' })}
              isMutating={mutation.isPending}
            />
          </Card>
        </Col>
        <Col lg={8}>
          <Card>
            <Card.Header><Card.Title>Verlauf</Card.Title></Card.Header>
            <Card.Body>
              {isLoadingHistory ? <div className="text-center"><Spinner /></div> : (
                <WorkTimeHistory
                  sessions={historyData?.history || []}
                  onEdit={setEditSession}
                  onDelete={handleDelete}
                />
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <EditWorkTimeDialog
        show={!!editSession}
        onHide={() => setEditSession(null)}
        session={editSession}
        onSave={handleSave}
      />
    </>
  );
};

export default WorkTimeManagement;