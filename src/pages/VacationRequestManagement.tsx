import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Table, Badge, Spinner } from 'react-bootstrap';
import { PlusCircle, Check, X } from 'lucide-react';
import { AddVacationRequestDialog } from '@/components/vacation/AddVacationRequestDialog';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import TablePlaceholder from '@/components/TablePlaceholder';

const fetchRequests = async () => {
  const { data, error } = await supabase.functions.invoke('manage-vacation-requests', {
    body: { action: 'get' },
  });
  if (error) throw error;
  return data.requests;
};

const VacationRequestManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('vacations.manage');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['vacationRequests'],
    queryFn: fetchRequests,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: 'approved' | 'rejected' }) => {
      const { error } = await supabase.functions.invoke('manage-vacation-requests', {
        body: { action: 'update-status', payload: { id, status } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Status aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['vacationRequests'] });
      queryClient.invalidateQueries({ queryKey: ['vacations'] }); // Invalidate calendar view
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren."),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge bg="success">Genehmigt</Badge>;
      case 'rejected': return <Badge bg="danger">Abgelehnt</Badge>;
      default: return <Badge bg="warning">Ausstehend</Badge>;
    }
  };

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
          {isLoading ? <TablePlaceholder /> : (
            <Table responsive hover>
              <thead>
                <tr>
                  {canManage && <th>Mitarbeiter</th>}
                  <th>Von</th>
                  <th>Bis</th>
                  <th>Status</th>
                  <th>Notizen</th>
                  {canManage && <th className="text-end">Aktionen</th>}
                </tr>
              </thead>
              <tbody>
                {requests?.map((req: any) => (
                  <tr key={req.id}>
                    {canManage && <td>{`${req.profiles?.first_name || ''} ${req.profiles?.last_name || ''}`.trim()}</td>}
                    <td>{new Date(req.start_date).toLocaleDateString()}</td>
                    <td>{new Date(req.end_date).toLocaleDateString()}</td>
                    <td>{getStatusBadge(req.status)}</td>
                    <td>{req.notes}</td>
                    {canManage && (
                      <td className="text-end">
                        {req.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="sm" className="text-success" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'approved' })}><Check /></Button>
                            <Button variant="ghost" size="sm" className="text-danger" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'rejected' })}><X /></Button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      <AddVacationRequestDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} />
    </>
  );
};

export default VacationRequestManagement;