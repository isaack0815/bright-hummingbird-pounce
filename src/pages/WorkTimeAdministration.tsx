import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, Button, Form } from 'react-bootstrap';
import { WorkTimeHistory } from '@/components/work-time/WorkTimeHistory';
import { EditWorkTimeDialog } from '@/components/work-time/EditWorkTimeDialog';
import { WorkTimeSummary } from '@/components/work-time/WorkTimeSummary';
import { showError, showSuccess } from '@/utils/toast';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfYear } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import Select from 'react-select';
import type { ChatUser } from '@/types/chat';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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
    queryFn: () => manageWorkTime('get-work-time-history', monthRange),
    enabled: !!selectedUserId,
  });

  const yearRange = useMemo(() => ({
    startDate: startOfYear(currentMonth).toISOString(),
    endDate: new Date().toISOString(),
    userId: selectedUserId,
  }), [currentMonth, selectedUserId]);

  const { data: yearHistoryData, isLoading: isLoadingYearHistory } = useQuery({
    queryKey: ['workTimeHistoryYear', yearRange],
    queryFn: () => manageWorkTime('get-work-time-history', yearRange),
    enabled: !!selectedUserId,
  });

  const { data: workDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['userWorkDetails', selectedUserId],
    queryFn: () => manageWorkTime('get-user-work-details', { userId: selectedUserId }),
    enabled: !!selectedUserId,
  });

  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string, payload?: any }) => manageWorkTime(action, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workTimeHistory', monthRange] });
      queryClient.invalidateQueries({ queryKey: ['workTimeHistoryYear', yearRange] });
      setEditSession(null);

      if (variables.action === 'delete-work-time') {
        showSuccess("Eintrag gelöscht!");
      } else if (variables.action === 'update-work-time') {
        showSuccess("Eintrag gespeichert!");
      } else if (variables.action === 'create-work-time') {
        showSuccess("Neuer Eintrag erstellt.");
      }
    },
    onError: (err: any) => showError(err.message || "Ein Fehler ist aufgetreten."),
  });

  const handleSave = (id: number, data: any) => {
    mutation.mutate({ action: 'update-work-time', payload: { id, ...data, userId: selectedUserId } });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Möchten Sie diesen Zeiteintrag wirklich löschen?")) {
      mutation.mutate({ action: 'delete-work-time', payload: { id } });
    }
  };

  const handleCreate = (date: Date) => {
    if (!selectedUserId) return;
    const startTime = new Date(date);
    startTime.setHours(8, 0, 0, 0);
    mutation.mutate({
      action: 'create-work-time',
      payload: {
        userId: selectedUserId,
        start_time: startTime.toISOString(),
        break_duration_minutes: 0,
      }
    });
  };

  const userOptions = users?.map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''}`.trim() }));

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Personal-Zeiterfassung</h1>
        <div className="d-flex align-items-center gap-2">
            <Button 
                variant="outline-secondary" 
                disabled={!selectedUserId}
                onClick={() => navigate(`/work-time-admin/annual-summary?userId=${selectedUserId}`)}
            >
                <BarChart3 size={16} className="me-2" />
                Jahresübersicht
            </Button>
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
      </div>

      {selectedUserId ? (
        <>
          <WorkTimeSummary 
            sessions={historyData?.history || []}
            yearSessions={yearHistoryData?.history || []}
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
              {isLoadingHistory || isLoadingDetails || isLoadingYearHistory ? <div className="text-center"><Spinner /></div> : (
                <WorkTimeHistory
                  sessions={historyData?.history || []}
                  onEdit={setEditSession}
                  onDelete={handleDelete}
                  onCreate={handleCreate}
                  month={currentMonth}
                  targetHoursPerWeek={workDetails?.details?.hours_per_week || null}
                  onSave={handleSave}
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