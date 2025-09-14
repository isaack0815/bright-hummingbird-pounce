import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner, Row, Col, Badge } from 'react-bootstrap';
import { PlusCircle, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { AddVacationRequestDialog } from '@/components/vacation/AddVacationRequestDialog';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { de } from 'date-fns/locale';
import { format, eachDayOfInterval, parseISO, startOfDay } from 'date-fns';
import type { VacationRequest } from '@/types/vacation';

const fetchRequests = async (canManage: boolean, userId: string | null): Promise<VacationRequest[]> => {
  let query = supabase.from('vacation_requests').select('*');
  
  if (!canManage && userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data: requests, error: requestsError } = await query.order('created_at', { ascending: false });
  if (requestsError) throw requestsError;
  if (!requests || requests.length === 0) return [];

  const userIds = [...new Set(requests.map(req => req.user_id))];
  if (userIds.length === 0) return requests.map(r => ({...r, profiles: null}));

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', userIds);
  if (profilesError) throw profilesError;

  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  return requests.map(req => ({
    ...req,
    profiles: profilesMap.get(req.user_id) || null
  }));
};

const VacationRequestManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('vacations.manage');

  const { data: requests, isLoading } = useQuery<VacationRequest[]>({
    queryKey: ['vacationRequests'],
    queryFn: () => fetchRequests(canManage, user?.id || null),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: 'approved' | 'rejected' }) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase.from('vacation_requests')
        .update({ status, approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Status aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['vacationRequests'] });
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren."),
  });

  const requestsByDay = useMemo(() => {
    const map = new Map<string, VacationRequest[]>();
    if (!requests) return map;
    requests.forEach(req => {
      const interval = { start: parseISO(req.start_date), end: parseISO(req.end_date) };
      eachDayOfInterval(interval).forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        if (!map.has(dayKey)) map.set(dayKey, []);
        map.get(dayKey)!.push(req);
      });
    });
    return map;
  }, [requests]);

  const modifiers = useMemo(() => {
    const approved: Date[] = [];
    const pending: Date[] = [];
    const rejected: Date[] = [];
    requests?.forEach(req => {
      const interval = { start: parseISO(req.start_date), end: parseISO(req.end_date) };
      const dates = eachDayOfInterval(interval).map(d => startOfDay(d));
      if (req.status === 'approved') approved.push(...dates);
      else if (req.status === 'pending') pending.push(...dates);
      else if (req.status === 'rejected') rejected.push(...dates);
    });
    return { approved, pending, rejected };
  }, [requests]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge bg="success">Genehmigt</Badge>;
      case 'rejected': return <Badge bg="danger">Abgelehnt</Badge>;
      default: return <Badge bg="warning">Ausstehend</Badge>;
    }
  };

  const selectedRequests = selectedDate ? requestsByDay.get(format(selectedDate, 'yyyy-MM-dd')) || [] : [];

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Urlaubsanträge</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle size={16} className="me-2" />
          Neuen Antrag stellen
        </Button>
      </div>
      <Card>
        <Card.Body>
          {isLoading ? <div className="text-center p-5"><Spinner /></div> : (
            <Row>
              <Col md={7}>
                <DayPicker
                  locale={de}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  selected={selectedDate}
                  onDayClick={setSelectedDate}
                  modifiers={modifiers}
                  modifiersClassNames={{ approved: 'day-approved', pending: 'day-pending', rejected: 'day-rejected' }}
                  showOutsideDays
                  components={{ IconLeft: () => <ChevronLeft size={16} />, IconRight: () => <ChevronRight size={16} /> }}
                />
              </Col>
              <Col md={5}>
                <div className="ps-3 border-start h-100">
                  <h6 className="mb-3">Anträge für den {selectedDate ? format(selectedDate, 'd. MMMM', { locale: de }) : ''}</h6>
                  {selectedRequests.length > 0 ? (
                    <div className="d-flex flex-column gap-3">
                      {selectedRequests.map(req => (
                        <div key={req.id} className="p-2 border rounded">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <p className="fw-bold small mb-0">{canManage ? `${req.profiles?.first_name} ${req.profiles?.last_name}` : 'Mein Antrag'}</p>
                              <p className="small text-muted mb-1">{format(parseISO(req.start_date), 'dd.MM')} - {format(parseISO(req.end_date), 'dd.MM.yy')}</p>
                            </div>
                            {getStatusBadge(req.status)}
                          </div>
                          {req.notes && <p className="small fst-italic mt-1 mb-1">"{req.notes}"</p>}
                          {canManage && req.status === 'pending' && (
                            <div className="text-end mt-2">
                              <Button variant="link" size="sm" className="text-success p-1" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'approved' })}><Check /></Button>
                              <Button variant="link" size="sm" className="text-danger p-1" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'rejected' })}><X /></Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted small">Keine Anträge für diesen Tag.</p>
                  )}
                </div>
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>
      <AddVacationRequestDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} />
    </>
  );
};

export default VacationRequestManagement;