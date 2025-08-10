import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Table, Spinner, Button } from 'react-bootstrap';
import { eachDayOfInterval, format } from 'date-fns';
import { de } from 'date-fns/locale';
import Select from 'react-select';
import { Save, Trash2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import type { Tour } from '@/types/tour';

const fetchRosterDetails = async (rosterId: number) => {
  const { data, error } = await supabase.functions.invoke('get-roster-details', { body: { rosterId } });
  if (error) throw error;
  return data.roster;
};

const fetchTours = async (): Promise<Tour[]> => {
  const { data, error } = await supabase.functions.invoke('get-tours');
  if (error) throw error;
  return data.tours;
};

export const RosterGrid = ({ rosterId }: { rosterId: number }) => {
  const [grid, setGrid] = useState<Record<string, Record<string, number | null>>>({});
  const queryClient = useQueryClient();

  const { data: roster, isLoading } = useQuery({
    queryKey: ['rosterDetails', rosterId],
    queryFn: () => fetchRosterDetails(rosterId),
  });

  const { data: tours, isLoading: isLoadingTours } = useQuery({
    queryKey: ['tours'],
    queryFn: fetchTours,
  });

  useEffect(() => {
    if (roster) {
      const newGrid: Record<string, Record<string, number | null>> = {};
      roster.entries.forEach((entry: any) => {
        if (!newGrid[entry.user_id]) {
          newGrid[entry.user_id] = {};
        }
        newGrid[entry.user_id][entry.duty_date] = entry.tour_id;
      });
      setGrid(newGrid);
    }
  }, [roster]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries: any[] = [];
      Object.entries(grid).forEach(([userId, dates]) => {
        Object.entries(dates).forEach(([date, tourId]) => {
          if (tourId) {
            entries.push({ user_id: userId, duty_date: date, tour_id: tourId });
          }
        });
      });
      const { error } = await supabase.functions.invoke('manage-rosters', { body: { action: 'update-entries', rosterId, entries } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Dienstplan gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['rosterDetails', rosterId] });
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

  const handleCellChange = (userId: string, date: string, tourId: number | null) => {
    setGrid(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [date]: tourId,
      },
    }));
  };

  const dates = useMemo(() => {
    if (!roster) return [];
    return eachDayOfInterval({ start: new Date(roster.start_date), end: new Date(roster.end_date) });
  }, [roster]);

  const tourOptions = tours?.map(tour => ({ value: tour.id, label: tour.name })) || [];
  const users = roster?.work_groups?.user_work_groups?.map((ug: any) => ug.profiles).filter(Boolean) || [];

  if (isLoading) return <div className="text-center p-5"><Spinner /></div>;
  if (!roster) return <p>Dienstplan nicht gefunden.</p>;

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <Card.Title>{roster.work_groups?.name}</Card.Title>
          <Card.Text className="text-muted small mb-0">
            {format(new Date(roster.start_date), 'dd.MM.yyyy')} - {format(new Date(roster.end_date), 'dd.MM.yyyy')}
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
      <Card.Body>
        <Table bordered responsive>
          <thead>
            <tr>
              <th style={{minWidth: '150px'}}>Mitarbeiter</th>
              {dates.map(date => (
                <th key={date.toISOString()} className="text-center" style={{minWidth: '120px'}}>
                  {format(date, 'E', { locale: de })}<br/>
                  <small>{format(date, 'dd.MM', { locale: de })}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user: any) => (
              <tr key={user.id}>
                <td>{user.first_name} {user.last_name}</td>
                {dates.map(date => {
                  const dateString = format(date, 'yyyy-MM-dd');
                  const selectedTourId = grid[user.id]?.[dateString] || null;
                  return (
                    <td key={dateString}>
                      <Select
                        options={tourOptions}
                        value={tourOptions.find(o => o.value === selectedTourId) || null}
                        onChange={(option) => handleCellChange(user.id, dateString, option?.value || null)}
                        isClearable
                        isLoading={isLoadingTours}
                        placeholder="-"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};