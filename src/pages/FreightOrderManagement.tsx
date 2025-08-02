import { useMemo } from 'react';
import { Card, Button, Tabs, Tab, Placeholder } from 'react-bootstrap';
import { PlusCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useError } from '@/contexts/ErrorContext';
import type { FreightOrder } from '@/types/freight';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { OrderTable } from '@/components/freight/OrderTable';

const fetchFreightOrders = async (): Promise<FreightOrder[]> => {
  const { data, error } = await supabase.functions.invoke('get-freight-orders');
  if (error) throw new Error(error.message);
  return data.orders;
};

const FreightOrderManagement = () => {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: orders, isLoading, error } = useQuery<FreightOrder[]>({
    queryKey: ['freightOrders'],
    queryFn: fetchFreightOrders,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-freight-order', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Auftrag erfolgreich gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.message || "Fehler beim Löschen des Auftrags.");
    },
  });

  const handleDeleteClick = (id: number) => {
    if (window.confirm("Sind Sie sicher, dass Sie diesen Auftrag löschen möchten?")) {
      deleteMutation.mutate(id);
    }
  };

  const { myOrders, otherOrders, completedOrders } = useMemo(() => {
    if (!orders || !user) {
      return { myOrders: [], otherOrders: [], completedOrders: [] };
    }

    const activeOrders = orders.filter(o => o.status !== 'Zugestellt' && o.status !== 'Storniert');
    const completed = orders.filter(o => o.status === 'Zugestellt' || o.status === 'Storniert');

    return {
      myOrders: activeOrders.filter(o => o.created_by === user.id),
      otherOrders: activeOrders.filter(o => o.created_by !== user.id),
      completedOrders: completed,
    };
  }, [orders, user]);

  if (error) {
    addError(error, 'API');
    showError(`Fehler beim Laden der Aufträge: ${error.message}`);
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h2">Frachtaufträge</h1>
        <Button onClick={() => navigate('/freight-orders/new')}>
          <PlusCircle className="me-2" size={16} />
          Auftrag hinzufügen
        </Button>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Auftragsliste</Card.Title>
          <Card.Text className="text-muted">Hier sehen Sie alle für Sie zugänglichen Aufträge, aufgeteilt nach Kategorien.</Card.Text>
        </Card.Header>
        <Card.Body>
          <Tabs defaultActiveKey="my-orders" id="order-tabs" className="mb-3 nav-fill">
            <Tab eventKey="my-orders" title="Meine Aufträge">
              {isLoading ? <Placeholder animation="glow"><Placeholder xs={12} style={{ height: '150px' }} /></Placeholder> : <OrderTable orders={myOrders} onDelete={handleDeleteClick} />}
            </Tab>
            <Tab eventKey="other-orders" title="Aufträge anderer">
              {isLoading ? <Placeholder animation="glow"><Placeholder xs={12} style={{ height: '150px' }} /></Placeholder> : <OrderTable orders={otherOrders} onDelete={handleDeleteClick} />}
            </Tab>
            <Tab eventKey="completed-orders" title="Abgeschlossen">
              {isLoading ? <Placeholder animation="glow"><Placeholder xs={12} style={{ height: '150px' }} /></Placeholder> : <OrderTable orders={completedOrders} onDelete={handleDeleteClick} />}
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
};

export default FreightOrderManagement;