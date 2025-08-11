import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Table, Spinner, Button } from 'react-bootstrap';
import { eachDayOfInterval, format, isWeekend } from 'date-fns';
import { Save, Trash2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import type { Tour } from '@/types/tour';
import { AssignUsersToTourDialog } from './AssignUsersToTourDialog';

type Member = { id: string; first_name: string | null; last_name: string | null; };

const fetchRosterDetailsForMonth = async (workGroupId: number, year: number, month: number) => {
  const { data, error } = await supabase.functions.invoke('get-roster-details-for-month', {
    body: { workGroupId, year, month },
  });
  if (error) throw error;
  return data;
};

const fetchTours = async (): Promise<Tour[]> => {
  const { data, error } = await supabase.functions.invoke('get-tours');
  if (error) throw error;
  return data.tours;
};

export const RosterGrid = ({ workGroupId, rosterId }: { workGroupId: number, rosterId: number }) => {
  const [assignments, setAssignments] = useState<Record<string, Record<number, string[]>>>({});
  const [modalData, setModalData] = useState<{ date: Date; tourId: number; tourName: string; } | null>(null);
  const queryClient = useQueryClient();

  const { data: rosterData, isLoading } = useQuery({
    queryKey: ['rosterDetailsForMonth', workGroupId, rosterId],
    queryFn: async () => {
        const { data: roster, error } = await supabase.from('duty_rosters').select('start_date, end_date, work_groups(name)').eq('id', rosterId).single();
        if (error) throw error;
        
        const year = new Date(roster.start_date).getFullYear();
        const month = new Date(roster.start_date).getMonth();

        const details = await fetchRosterDetailsForMonth(workGroupId, year, month);
        return { ...details, ...roster };
    },
  });

  const { data: tours, isLoading: isLoadingTours } = useQuery({
    queryKey: ['tours'],
    queryFn: fetchTours,
  });

  useEffect(() => {
    if (rosterData?.entries) {
      const newAssignments: Record<string, Record<number, string[]>> = {};
      for (const entry of rosterData.entries) {
        const dateStr = entry.duty_date;
        if (!newAssignments[dateStr]) {
          newAssignments[dateStr] = {};
        }
        if (!newAssignments[dateStr][entry.tour_id]) {
          newAssignments[dateStr][entry.tour_id] = [];
        }
        newAssignments[dateStr][entry.tour_id].push(entry.user_id);
      }
      setAssignments(newAssignments);
    }
  }, [rosterData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries: { user_id: string; duty_date: string; tour_id: number }[] = [];
      Object.entries(assignments).forEach(([date, tours]) => {
        Object.entries(tours).forEach(([tourId, userIds]) => {
          userIds.forEach(userId => {
            if (userId && tourId) {
              entries.push({
                user_id: userId,
                duty_date: date,
                tour_id: Number(tourId),
              });
            }
          });
        });
      });
      const { error } = await supabase.functions.invoke('manage-rosters', { body: { action: 'update-entries', rosterId, entries } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Dienstplan gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['rosterDetailsForMonth', workGroupId, rosterId] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern."),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
        if (!window.confirm("Sind Sie sicher, dass Sie diesen Plan löschen möchten?")) throw new Error("Löschen abgebrochen");
        const { error } = await supabase.functions.invoke('manage-rosters', { body: { action: 'delete', rosterId } });
        if (error) throw error;
    },
    onSuccess: () => {
        showSuccess("Dienstplan gelöscht!");
        queryClient.invalidateQueries({ queryKey: ['workGroupsWithRosters'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen."),
  });

  const handleOpenModal = (date: Date, tourId: number, tourName: string) => {
    setModalData({ date, tourId, tourName });
  };

  const handleSaveAssignments = (newUserIds: string[]) => {
    if (!modalData) return;
    const dateStr = format(modalData.date, 'yyyy-MM-dd');
    setAssignments(prev => {
      const newAssignmentsForDate = { ...prev[dateStr], [modalData.tourId]: newUserIds };
      return { ...prev, [dateStr]: newAssignmentsForDate };
    });
  };

  const dates = useMemo(() => {
    if (!rosterData) return [];
    return eachDayOfInterval({ start: new Date(rosterData.start_date), end: new Date(rosterData.end_date) });
  }, [rosterData]);

  const members = rosterData?.members || [];
  const membersMap = useMemo(() => new Map(members.map((m: Member) => [m.id, m])), [members]);

  if (isLoading || isLoadingTours) return <div className="text-center p-5"><Spinner /></div>;
  if (!rosterData || !tours) return <p>Dienstplandaten konnten nicht geladen werden.</p>;

  return (
    <>
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <div>
            <Card.Title>{rosterData.work_groups?.name}</Card.Title>
            <Card.Text className="text-muted small mb-0">
              {format(new Date(rosterData.start_date), 'dd.MM.yyyy')} - {format(new Date(rosterData.end_date), 'dd.MM.yyyy')}
            </Card.Text>
          </div>
          <div>
              <Button variant="outline-danger" size="sm" className="me-2" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                  <Trash2 size={16} />
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save size={16} className="me-2" />
                  {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
              </Button>
          </div>
        </Card.Header>
        <Card.Body className="table-responsive">
          <Table bordered hover>
            <thead>
              <tr>
                <th>Tag</th>
                {tours.map(tour => <th key={tour.id}>{tour.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isWeekendDay = isWeekend(date);
                return (
                  <tr key={dateStr} className={isWeekendDay ? 'table-info' : ''}>
                    <td>{format(date, 'd')}</td>
                    {tours.map(tour => {
                      const assignedUserIds = assignments[dateStr]?.[tour.id] || [];
                      const assignedUsers = assignedUserIds.map(id => membersMap.get(id)).filter(Boolean);
                      return (
                        <td key={tour.id}>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="w-100 mb-1"
                            onClick={() => handleOpenModal(date, tour.id, tour.name)}
                          >
                            Bearbeiten
                          </Button>
                          <div className="small text-muted mt-1">
                            {assignedUsers.map(user => (
                              <div key={user!.id}>{user!.first_name} {user!.last_name}</div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
      {modalData && (
        <AssignUsersToTourDialog
          show={!!modalData}
          onHide={() => setModalData(null)}
          tourName={modalData.tourName}
          availableMembers={members}
          selectedUserIds={assignments[format(modalData.date, 'yyyy-MM-dd')]?.[modalData.tourId] || []}
          onSave={handleSaveAssignments}
        />
      )}
    </>
  );
};