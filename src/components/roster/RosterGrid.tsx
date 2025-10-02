import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Table, Spinner } from 'react-bootstrap';
import { eachDayOfInterval, format, isWeekend } from 'date-fns';
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
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action: 'get-tours' }
  });
  if (error) throw new Error(error.message);
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

  const saveDayMutation = useMutation({
    mutationFn: async ({ date, assignmentsForDay }: { date: Date; assignmentsForDay: Record<number, string[]> }) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const assignmentsPayload = Object.entries(assignmentsForDay).flatMap(([tourId, userIds]) => 
            userIds.map(userId => ({ user_id: userId, tour_id: Number(tourId) }))
        );

        const { error } = await supabase.functions.invoke('manage-rosters', {
            body: {
                action: 'update-entries-for-day',
                rosterId,
                date: dateStr,
                assignments: assignmentsPayload,
            },
        });
        if (error) throw error;
    },
    onSuccess: (_, variables) => {
        showSuccess(`Änderungen für ${format(variables.date, 'dd.MM.yyyy')} gespeichert!`);
        queryClient.invalidateQueries({ queryKey: ['rosterDetailsForMonth', workGroupId, rosterId] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern des Tages."),
  });

  const handleOpenModal = (date: Date, tourId: number, tourName: string) => {
    setModalData({ date, tourId, tourName });
  };

  const handleSaveAssignments = (newUserIds: string[]) => {
    if (!modalData) return;
    const dateStr = format(modalData.date, 'yyyy-MM-dd');
    
    const newAssignmentsForDate = { ...(assignments[dateStr] || {}), [modalData.tourId]: newUserIds };
    const newAssignments = { ...assignments, [dateStr]: newAssignmentsForDate };
    setAssignments(newAssignments);

    saveDayMutation.mutate({ date: modalData.date, assignmentsForDay: newAssignmentsForDate });
  };

  const dates = useMemo(() => {
    if (!rosterData) return [];
    return eachDayOfInterval({ start: new Date(rosterData.start_date), end: new Date(rosterData.end_date) });
  }, [rosterData]);

  const members = rosterData?.members || [];
  const membersMap = useMemo(() => new Map(members.map((m: Member) => [m.id, m])), [members]);

  const unavailableUserIdsForModal = useMemo(() => {
    if (!modalData) return [];
    const dateStr = format(modalData.date, 'yyyy-MM-dd');
    const assignmentsForDay = assignments[dateStr] || {};
    const busyUserIds = new Set<string>();
    for (const tourIdStr in assignmentsForDay) {
      const tourId = Number(tourIdStr);
      if (tourId !== modalData.tourId) {
        assignmentsForDay[tourId].forEach(userId => busyUserIds.add(userId));
      }
    }
    return Array.from(busyUserIds);
  }, [modalData, assignments]);

  if (isLoading || isLoadingTours) return <div className="text-center p-5"><Spinner /></div>;
  if (!rosterData || !tours) return <p>Dienstplandaten konnten nicht geladen werden.</p>;

  return (
    <>
      <Card>
        <Card.Header>
          <Card.Title>{rosterData.work_groups?.name}</Card.Title>
          <Card.Text className="text-muted small mb-0">
            {format(new Date(rosterData.start_date), 'dd.MM.yyyy')} - {format(new Date(rosterData.end_date), 'dd.MM.yyyy')}
          </Card.Text>
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
                      const assignedUsers = assignedUserIds.map(id => membersMap.get(id)).filter(Boolean) as Member[];
                      const userNames = assignedUsers.map(user => {
                        const firstNameInitial = user.first_name ? `${user.first_name.charAt(0)}.` : '';
                        return `${user.last_name || ''} ${firstNameInitial}`.trim();
                      }).join(', ');

                      return (
                        <td 
                          key={tour.id} 
                          onClick={() => handleOpenModal(date, tour.id, tour.name)}
                          className="roster-cell"
                          style={{ cursor: 'pointer', minHeight: '40px' }}
                        >
                          <div className="small text-muted">
                            {userNames || <>&nbsp;</>}
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
          unavailableUserIds={unavailableUserIdsForModal}
        />
      )}
    </>
  );
};