import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner, Table, Alert, Row, Col, Badge } from 'react-bootstrap';
import { PlusCircle } from 'lucide-react';
import { AddVacationRequestDialog } from '@/components/vacation/AddVacationRequestDialog';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/utils/toast';
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: myRequests, isLoading: isLoadingMyRequests } = useQuery<VacationRequest[]>({
    queryKey: ['myVacationRequests', user?.id],
    queryFn: () => fetchMyRequests(user!.id),
    enabled: !!user,
  });

  const { data: myProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['myVacationProfile', user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user,
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

  const isLoading = isLoadingMyRequests || isLoadingProfile;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Meine Urlaubsplanung</h1>
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
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['myVacationRequests', user?.id] });
        }}
      />
    </>
  );
};

export default VacationRequestManagement;