import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Row, Col, Spinner, Button, Form } from 'react-bootstrap';
import { WorkTimeHistory } from '@/components/work-time/WorkTimeHistory';
import { EditWorkTimeDialog } from '@/components/work-time/EditWorkTimeDialog';
import { WorkTimeSummary } from '@/components/work-time/WorkTimeSummary';
import { showError, showSuccess } from '@/utils/toast';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Select from 'react-select';
import type { ChatUser } from '@/types/chat';

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

const fetchUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

const WorkTimeAdministration = () => {
  const [editSession, setEditSession] = useState<WorkSession | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: users, isLoading: isLoadingUsers } = useQuery<ChatUser[]>({
    queryKey: ['chatUsers'],
    queryFn: fetchUsers,
  });

  const monthRange = useMemo(() => ({
    startDate: startOfMonth(currentMonth).toISOString(),
    endDate: endOfMonth(currentMonth).toISOString(),
    userId: selectedUserId,
  }), [currentMonth, selectedUserId]);

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['workTimeHistory', monthRange],
    queryFn: () => manageWorkTime('get-history', monthRange),
    enabled: !!selectedUserId,
  });

  const { data: workDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['userWorkDetails', selectedUserId],
    queryFn: () => manageWorkTime('get-user-work-details', { userId: selectedUserId }),
    enabled: !!selectedUserId,
  });

  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string, payload?: any }) => manageWorkTime(action, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTimeHistory', monthRange] });
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

  const userOptions = users?.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }));

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Personal-Zeiterfassung</h1>
        <div style={{ width: '300px' }}>
          <Select
            options={userOptions}
            isLoading={isLoadingUsers}
            onChange={(opt) => setSelectedUserId(opt?.value || null)}
            placeholder="Mitarbeiter auswählen..."
            isClearable
          />
        </div>
      </div>

      {selectedUserId ? (
        <>
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
              {isLoadingHistory || isLoadingDetails ? <div className="text-center"><Spinner /></div> : (
                <WorkTimeHistory
                  sessions={historyData?.history || []}
                  onEdit={setEditSession}
                  onDelete={handleDelete}
                />
              )}
            </Card.Body>
          </Card>
        </>
      ) : (
        <Card><Card.Body className="text-center text-muted py-5">Bitte wählen Sie einen Mitarbeiter aus.</Card.Body></Card>
      )}

      <EditWorkTimeDialog
        show={!!editSession}
        onHide={() => setEditSession(null)}
        session={editSession}
        onSave={handleSave}
      />
    </>
  );
};

export default WorkTimeAdministration;