import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Card, Button, Spinner, Form } from 'react-bootstrap';
import { PlusCircle } from 'lucide-react';
import { CreateRosterDialog } from '@/components/roster/CreateRosterDialog';
import { RosterCalendar } from '@/components/roster/RosterCalendar';
import type { WorkGroup } from '@/types/workgroup';
import { startOfMonth, endOfMonth, isWithinInterval, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { showSuccess, showError } from '@/utils/toast';

const fetchWorkGroupsWithRosters = async () => {
  const { data, error } = await supabase.functions.invoke('get-work-groups-with-rosters');
  if (error) throw error;
  return data.groups;
};

const DutyRoster = () => {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['workGroupsWithRosters'],
    queryFn: fetchWorkGroupsWithRosters,
  });

  const selectedGroup = useMemo(() => groups?.find((g: any) => g.id === selectedGroupId), [groups, selectedGroupId]);

  const rosterForCurrentMonth = useMemo(() => {
    if (!selectedGroup || !Array.isArray(selectedGroup.duty_rosters)) return null;
    const monthStart = startOfMonth(currentMonth);
    return selectedGroup.duty_rosters.find((r: any) => {
      const rosterStart = parseISO(r.start_date);
      const rosterEnd = parseISO(r.end_date);
      return isWithinInterval(monthStart, { start: rosterStart, end: rosterEnd });
    });
  }, [selectedGroup, currentMonth]);

  const createRosterMutation = useMutation({
    mutationFn: async () => {
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const { error } = await supabase.functions.invoke('manage-rosters', {
        body: { action: 'create', work_group_id: selectedGroupId, start_date: startDate, end_date: endDate },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Dienstplan für den Monat erstellt!");
      queryClient.invalidateQueries({ queryKey: ['workGroupsWithRosters'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen."),
  });

  return (
    <>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h2">Dienstplan</h1>
          <div className="d-flex align-items-center gap-3">
            {isLoading ? <Spinner size="sm" /> : (
              <Form.Select 
                style={{width: '250px'}} 
                onChange={(e) => setSelectedGroupId(Number(e.target.value) || null)}
                value={selectedGroupId || ''}
              >
                <option value="">Arbeitsgruppe auswählen...</option>
                {groups?.map((group: any) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </Form.Select>
            )}
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <PlusCircle size={16} className="me-2" />
              Neuen Plan erstellen
            </Button>
          </div>
        </div>
        
        {selectedGroupId ? (
          rosterForCurrentMonth ? (
            <RosterCalendar 
              workGroupId={selectedGroupId} 
              currentMonth={currentMonth} 
              onMonthChange={setCurrentMonth} 
              rosterId={rosterForCurrentMonth.id}
            />
          ) : (
            <Card>
              <Card.Body className="text-center" style={{minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
                <p className="text-muted">Für {format(currentMonth, 'MMMM yyyy', { locale: de })} existiert kein Dienstplan.</p>
                <Button onClick={() => createRosterMutation.mutate()} disabled={createRosterMutation.isPending}>
                  {createRosterMutation.isPending ? <Spinner size="sm" /> : `Dienstplan für ${format(currentMonth, 'MMMM yyyy')} anlegen`}
                </Button>
              </Card.Body>
            </Card>
          )
        ) : (
          <Card className="h-100">
            <Card.Body className="d-flex justify-content-center align-items-center" style={{minHeight: '60vh'}}>
              <p className="text-muted">Bitte wählen Sie eine Arbeitsgruppe aus, um den Dienstplan anzuzeigen.</p>
            </Card.Body>
          </Card>
        )}
      </Container>
      <CreateRosterDialog show={isCreateDialogOpen} onHide={() => setIsCreateDialogOpen(false)} />
    </>
  );
};

export default DutyRoster;