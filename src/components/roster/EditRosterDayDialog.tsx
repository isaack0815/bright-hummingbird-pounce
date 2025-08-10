import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Modal, Button, Form, Spinner, ListGroup, Alert } from 'react-bootstrap';
import Select from 'react-select';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Tour } from '@/types/tour';

type Member = { id: string; first_name: string | null; last_name: string | null };

type EditRosterDayDialogProps = {
  show: boolean;
  onHide: () => void;
  date: Date | null;
  rosterId: number | null;
  members: Member[];
  initialAssignments: Record<string, number | null>;
};

const fetchTours = async (): Promise<Tour[]> => {
  const { data, error } = await supabase.functions.invoke('get-tours');
  if (error) throw error;
  return data.tours;
};

export const EditRosterDayDialog = ({ show, onHide, date, rosterId, members, initialAssignments }: EditRosterDayDialogProps) => {
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  const queryClient = useQueryClient();

  const { data: tours, isLoading: isLoadingTours } = useQuery({
    queryKey: ['tours'],
    queryFn: fetchTours,
    enabled: show,
  });

  useEffect(() => {
    if (show) {
      setAssignments(initialAssignments);
    }
  }, [initialAssignments, show]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!rosterId || !date) throw new Error("Roster or date is missing.");
      
      const entries = Object.entries(assignments)
        .filter(([, tourId]) => tourId !== null)
        .map(([userId, tourId]) => ({
          user_id: userId,
          tour_id: tourId,
        }));

      const { error } = await supabase.functions.invoke('update-roster-entries-for-day', {
        body: {
          rosterId,
          date: format(date, 'yyyy-MM-dd'),
          assignments: entries,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Dienstplan für den Tag gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['rosterDetailsForMonth'] });
      onHide();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern."),
  });

  const handleAssignmentChange = (userId: string, tourId: number | null) => {
    setAssignments(prev => ({ ...prev, [userId]: tourId }));
  };

  const tourOptions = tours?.map(tour => ({ value: tour.id, label: tour.name })) || [];

  if (!date) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Dienstplan für {format(date, 'eeee, dd.MM.yyyy', { locale: de })}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!rosterId && <Alert variant="warning">Dieser Tag gehört zu keinem existierenden Dienstplan. Bitte erstellen Sie zuerst einen Plan für diesen Zeitraum, um Zuweisungen zu speichern.</Alert>}
        <ListGroup>
          {members.map(member => {
            const selectedTourId = assignments[member.id] || null;
            return (
              <ListGroup.Item key={member.id} className="d-flex justify-content-between align-items-center">
                <span>{member.first_name} {member.last_name}</span>
                <div style={{ width: '250px' }}>
                  <Select
                    options={tourOptions}
                    value={tourOptions.find(o => o.value === selectedTourId) || null}
                    onChange={(option) => handleAssignmentChange(member.id, option?.value || null)}
                    isClearable
                    isLoading={isLoadingTours}
                    placeholder="Tour auswählen..."
                    isDisabled={!rosterId}
                  />
                </div>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !rosterId}>
          {mutation.isPending ? <Spinner size="sm" /> : 'Speichern'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};