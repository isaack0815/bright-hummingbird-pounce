import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Row, Col, Spinner, Button } from 'react-bootstrap';
import { TimeClock } from '@/components/work-time/TimeClock';
import { WorkTimeHistory } from '@/components/work-time/WorkTimeHistory';
import { EditWorkTimeDialog } from '@/components/work-time/EditWorkTimeDialog';
import { WorkTimeSummary } from '@/components/work-time/WorkTimeSummary';
import { showError, showSuccess } from '@/utils/toast';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type WorkSession = {
  id: number;
  start_time: string;
  end_time: string | null;
  break_duration_minutes: number;
  notes: string | null;
};

const manageWorkTime = async (action: string, payload: any = {}) => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action, payload },
  });
  if (error) throw error;
  return data;
};

const WorkTimeManagement = () => {
  const [editSession, setEditSession] = useState<WorkSession | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const queryClient = useQueryClient();

  const { data: statusData, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['workTimeStatus'],
    queryFn: () => manageWorkTime('get-work-time-status'),
  });

  const monthRange = useMemo(() => ({
    startDate: startOfMonth(currentMonth).toISOString(),
    endDate: endOfMonth(currentMonth).toISOString(),
  }), [currentMonth]);

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['workTimeHistory', monthRange],
    queryFn: () => manageWorkTime('get-work-time-history', monthRange),
  });

  const { data: workDetails } = useQuery({
    queryKey: ['userWorkDetails'],
    queryFn: () => manageWorkTime('get-user-work-details'),
  });

  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string, payload?: any }) => manageWorkTime(action, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTimeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['workTimeHistory', monthRange] });
      setEditSession(null);
    },
    onError: (err: any) => showError(err.message || "Ein Fehler ist aufgetreten."),
  });

  const handleSave = (id: number, data: any) => {
    mutation.mutate({ action: 'update-work-time', payload: { id, ...data } });
    showSuccess("Eintrag gespeichert!");
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Möchten Sie diesen Zeiteintrag wirklich löschen?")) {
      mutation.mutate({ action: 'delete-work-time', payload: { id } });
      showSuccess("Eintrag gelöscht!");
    }
  };

  return (
    <>
      <h1 className="h2 mb-4">Meine Zeiterfassung</h1>
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
          <WorkTimeSummary 
            sessions={historyData?.history || []}
            targetHoursPerWeek={workDetails?.details?.hours_per_week || null}
            month={currentMonth}
          />
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <Card.Title className="mb-0">Verlauf für {format(currentMonth, 'MMMM yyyy', { locale: de })}</Card.Title>
              <div className="d-flex gap-2">
                <Button variant="outline-secondary" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft /></Button>
                <Button variant="outline-secondary" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight /></Button>
              </div>
            </Card.Header>
            <Card.Body>
              {isLoadingHistory ? <div className="text-center"><Spinner /></div> : (
                <WorkTimeHistory
                  sessions={historyData?.history || []}
                  onEdit={setEditSession}
                  onDelete={handleDelete}
                  month={currentMonth}
                  targetHoursPerWeek={workDetails?.details?.hours_per_week || null}
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