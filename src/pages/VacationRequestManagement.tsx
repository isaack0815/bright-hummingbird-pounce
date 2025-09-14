import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner, Form, Tabs, Tab, ListGroup, Row, Col, Badge } from 'react-bootstrap';
import { PlusCircle, Check, X } from 'lucide-react';
import { AddVacationRequestDialog } from '@/components/vacation/AddVacationRequestDialog';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { VacationRequest } from '@/types/vacation';
import type { ChatUser } from '@/types/chat';
import { MonthlyVacationTable } from '@/components/vacation/MonthlyVacationTable';

const fetchRequestsForYear = async (year: number): Promise<VacationRequest[]> => {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: requests, error } = await supabase
    .from('vacation_requests_with_profiles')
    .select('*')
    .lte('start_date', endDate)
    .gte('end_date', startDate);
  
  if (error) throw error;

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

const fetchUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

const VacationRequestManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('vacations.manage');
  const currentMonthIndex = new Date().getMonth();

  const { data: requests, isLoading: isLoadingRequests, error } = useQuery<VacationRequest[]>({
    queryKey: ['vacationRequestsForYear', year],
    queryFn: () => fetchRequestsForYear(year),
  });

  const { data: users, isLoading: isLoadingUsers } = useQuery<ChatUser[]>({
    queryKey: ['chatUsers'],
    queryFn: fetchUsers,
  });

  const manageRequestMutation = useMutation({
    mutationFn: async ({ action, payload }: { action: string, payload: any }) => {
      const { error } = await supabase.functions.invoke('action', {
        body: { action, payload },
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.action === 'create-vacation-request') {
        showSuccess(`Urlaubstag eingetragen.`);
      } else if (variables.action === 'update-vacation-request') {
        showSuccess("Urlaub erfolgreich aktualisiert!");
      } else {
        showSuccess(`Aktion erfolgreich ausgeführt.`);
      }
      queryClient.invalidateQueries({ queryKey: ['vacationRequestsForYear', year] });
    },
    onError: (err: any) => showError(err.message || "Fehler bei der Aktion."),
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
      queryClient.invalidateQueries({ queryKey: ['vacationRequestsForYear', year] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren."),
  });

  const handleCellClick = (userId: string, date: Date) => {
    if (!canManage) {
      showError("Nur Manager können direkt Urlaub eintragen.");
      return;
    }
    manageRequestMutation.mutate({
      action: 'create-vacation-request',
      payload: { userId, date: format(date, 'yyyy-MM-dd') },
    });
  };

  const handleDeleteRequest = (requestId: number) => {
    manageRequestMutation.mutate({
      action: 'delete-vacation-request',
      payload: { requestId },
    });
  };

  const handleUpdateRequest = (requestId: number, startDate: string, endDate: string) => {
    manageRequestMutation.mutate({
      action: 'update-vacation-request',
      payload: { requestId, startDate, endDate, notes: '' },
    });
  };

  const pendingRequests = useMemo(() => {
    return requests?.filter(r => r.status === 'pending') || [];
  }, [requests]);

  const yearOptions = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)), [year]);

  const isLoading = isLoadingRequests || isLoadingUsers;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Urlaubsplanung</h1>
        <div className="d-flex align-items-center gap-3">
          <Form.Select value={year} onChange={e => setYear(Number(e.target.value))} style={{width: '120px'}}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </Form.Select>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle size={16} className="me-2" />
            Urlaub beantragen
          </Button>
        </div>
      </div>
      
      {isLoading && <div className="text-center p-5"><Spinner /></div>}
      {error && <p className="text-danger">Fehler: {error.message}</p>}
      
      {requests && users && (
        <Tabs defaultActiveKey={currentMonthIndex} id="month-tabs" className="mb-3">
          {months.map((month, index) => (
            <Tab eventKey={index} title={format(month, 'MMMM', { locale: de })} key={index}>
              <Card>
                <Card.Body className="p-0">
                  <MonthlyVacationTable 
                    year={year} 
                    month={index} 
                    requests={requests} 
                    users={users}
                    onCellClick={handleCellClick}
                    onDeleteRequest={handleDeleteRequest}
                    onUpdateRequest={handleUpdateRequest}
                  />
                </Card.Body>
              </Card>
            </Tab>
          ))}
        </Tabs>
      )}

      {canManage && pendingRequests.length > 0 && (
        <Card className="mt-4">
          <Card.Header><Card.Title>Offene Anträge</Card.Title></Card.Header>
          <ListGroup variant="flush">
            {pendingRequests.map(req => (
              <ListGroup.Item key={req.id}>
                <Row className="align-items-center">
                  <Col>
                    <strong>{req.profiles?.first_name} {req.profiles?.last_name}</strong><br/>
                    <span className="text-muted">{format(parseISO(req.start_date), 'dd.MM.yy')} - {format(parseISO(req.end_date), 'dd.MM.yy')}</span>
                  </Col>
                  <Col md="auto">
                    <Button variant="link" size="sm" className="text-success p-1" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'approved' })}><Check /></Button>
                    <Button variant="link" size="sm" className="text-danger p-1" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'rejected' })}><X /></Button>
                  </Col>
                </Row>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card>
      )}

      <AddVacationRequestDialog 
        show={isAddDialogOpen} 
        onHide={() => setIsAddDialogOpen(false)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['vacationRequestsForYear', year] })}
      />
    </>
  );
};

export default VacationRequestManagement;