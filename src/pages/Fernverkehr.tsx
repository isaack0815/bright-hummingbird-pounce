import { useMemo } from 'react';
import { Card, Tabs, Tab } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useError } from '@/contexts/ErrorContext';
import type { FreightOrder } from '@/types/freight';
import { useAuth } from '@/contexts/AuthContext';
import { OrderTable } from '@/components/freight/OrderTable';
import TablePlaceholder from '@/components/TablePlaceholder';

const fetchFreightOrders = async (): Promise<FreightOrder[]> => {
  const { data, error } = await supabase.functions.invoke('get-freight-orders');
  if (error) throw new Error(error.message);
  return data.orders;
};

const Fernverkehr = () => {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const { hasPermission } = useAuth();
  const canBill = hasPermission('Abrechnung Fernverkehr');

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

  const { openBillings, archivedBillings } = useMemo(() => {
    if (!orders) {
      return { openBillings: [], archivedBillings: [] };
    }
    return {
      openBillings: orders.filter(o => !o.is_billed),
      archivedBillings: orders.filter(o => o.is_billed),
    };
  }, [orders]);

  if (error) {
    addError(error, 'API');
    showError(`Fehler beim Laden der Aufträge: ${error.message}`);
  }

  const tableCols = canBill ? 10 : 9;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h2">Übersicht Fernverkehr</h1>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Abrechnungsübersicht</Card.Title>
          <Card.Text className="text-muted">Hier sehen Sie alle offenen und bereits abgerechneten Aufträge.</Card.Text>
        </Card.Header>
        <Card.Body>
          <Tabs defaultActiveKey="open" id="billing-tabs" className="mb-3 nav-fill">
            <Tab eventKey="open" title="Offene Abrechnungen">
              {isLoading ? <TablePlaceholder cols={tableCols} /> : <OrderTable orders={openBillings} onDelete={handleDeleteClick} showBillingColumn={canBill} isBillingContext={true} />}
            </Tab>
            <Tab eventKey="archive" title="Archiv">
              {isLoading ? <TablePlaceholder cols={tableCols} /> : <OrderTable orders={archivedBillings} onDelete={handleDeleteClick} showBillingColumn={canBill} isBillingContext={true} />}
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Fernverkehr;