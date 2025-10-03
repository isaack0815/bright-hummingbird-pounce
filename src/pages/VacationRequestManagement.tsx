import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner, Table, Alert, Row, Col, Badge } from 'react-bootstrap';
import { PlusCircle, Check, X } from 'lucide-react';
import { AddVacationRequestDialog } from '@/components/vacation/AddVacationRequestDialog';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { eachDayOfInterval, isWeekend, parseISO } from 'date-fns';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { VacationRequest } from '@/types/vacation';

const fetchMyRequests = async (userId: string): Promise<VacationRequest[]> => {
  const { data, error } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data;
};

const fetchAllRequests = async (): Promise<VacationRequest[]> => {
  const { data, error } = await supabase
    .from('vacation_requests_with_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;

  // The view returns profile fields at the top level, we need to nest them for consistency
  const formattedRequests = requests?.map(req => {
    const { first_name, last_name, ...rest } = req;
    return {
      ...rest,
      profiles: {
        first_name,
        last_name,
      }
    };
  }) || [];

  return formattedRequests as VacationRequest[];
};

const fetchMyProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('vacation_days_per_year, works_weekends')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
};

const VacationRequestManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('vacations.manage');

  const { data: myRequests, isLoading: isLoadingMyRequests } = useQuery<VacationRequest[]>({
    queryKey: ['myVacationRequests', user?.id],
    queryFn: () => fetchMyRequests(user!.id),
    enabled: !!user,
  });

  const { data: allRequests, isLoading: isLoadingAllRequests } = useQuery<VacationRequest[]>({
    queryKey: ['allVacationRequests'],
    queryFn: fetchAllRequests,
    enabled: canManage,
  });

  const { data: myProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['myVacationProfile', user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user,
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
      queryClient.invalidateQueries({ queryKey: ['allVacationRequests'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren."),
  });

  const { takenDays, remainingDays } = useMemo(() => {
    if (!myRequests || !myProfile) return { takenDays: 0, remainingDays: 0 };
    
    const approvedRequests = myRequests.filter(r => r.status === 'approved');
    let totalDays = 0;

    for (const req of approvedRequests) {
      const days = eachDayOfInterval({ start: parseISO(req.start_date), end: parseISO(req.end_date) });
      const vacationDays = myProfile.works_weekends ? days.length : days.filter(day => !isWeekend(day)).length;
      totalDays += vacationDays;
    }
    
    const entitlement = myProfile.vacation_days_per_year || 0;
    return { takenDays: totalDays, remainingDays: entitlement - totalDays };
  }, [myRequests, myProfile]);

  const pendingRequests = useMemo(() => {
    return allRequests?.filter(r => r.status === 'pending') || [];
  }, [allRequests]);

  const isLoading = isLoadingMyRequests || isLoadingAllRequests || isLoadingProfile;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Urlaubsplanung</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle size={16} className="me-2" />
          Urlaub beantragen
        </Button>
      </div>
      
      <Row className="g-4 mb-4">
        <Col><Card body className="text-center"><h5>{myProfile?.vacation_days_per_year || 0}</h5><span className="text-muted">Tage Anspruch</span></Card></Col>
        <Col><Card body className="text-center"><h5>{takenDays}</h5><span className="text-muted">Tage Genommen</span></Card></Col>
        <Col><Card body className="text-center"><h5 className={remainingDays < 0 ? 'text-danger' : ''}>{remainingDays}</h5><span className="text-muted">Tage Übrig</span></Card></Col>
      </Row>

      {canManage && (
        <Card className="mb-4">
          <Card.Header><Card.Title>Offene Anträge</Card.Title></Card.Header>
          {isLoading ? <Card.Body><Spinner size="sm" /></Card.Body> : pendingRequests.length > 0 ? (
            <Table responsive hover>
              <thead><tr><th>Mitarbeiter</th><th>Zeitraum</th><th>Notizen</th><th className="text-end">Aktionen</th></tr></thead>
              <tbody>
                {pendingRequests.map(req => (
                  <tr key={req.id}>
                    <td>{req.profiles?.first_name} {req.profiles?.last_name}</td>
                    <td>{format(parseISO(req.start_date), 'dd.MM.yy')} - {format(parseISO(req.end_date), 'dd.MM.yy')}</td>
                    <td>{req.notes}</td>
                    <td className="text-end">
                      <Button variant="link" size="sm" className="text-success p-1" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'approved' })}><Check /></Button>
                      <Button variant="link" size="sm" className="text-danger p-1" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'rejected' })}><X /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <Card.Body><p className="text-muted">Keine offenen Anträge vorhanden.</p></Card.Body>}
        </Card>
      )}

      <Card>
        <Card.Header><Card.Title>Meine Anträge</Card.Title></Card.Header>
        <Card.Body>
          {isLoading ? <Spinner /> : myRequests && myRequests.length > 0 ? (
            <Table responsive striped>
              <thead><tr><th>Von</th><th>Bis</th><th>Status</th><th>Notizen</th></tr></thead>
              <tbody>
                {myRequests.map(req => (
                  <tr key={req.id}>
                    <td>{format(parseISO(req.start_date), 'PPP', { locale: de })}</td>
                    <td>{format(parseISO(req.end_date), 'PPP', { locale: de })}</td>
                    <td>
                      <Badge bg={req.status === 'approved' ? 'success' : req.status === 'pending' ? 'warning' : 'danger'}>
                        {req.status}
                      </Badge>
                    </td>
                    <td>{req.notes}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <Alert variant="info">Sie haben noch keine Urlaubsanträge gestellt.</Alert>}
        </Card.Body>
      </Card>

      <AddVacationRequestDialog 
        show={isAddDialogOpen} 
        onHide={() => setIsAddDialogOpen(false)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['myVacationRequests', user?.id] })}
      />
    </>
  );
};

export default VacationRequestManagement;