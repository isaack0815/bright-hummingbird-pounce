import { useMemo, useState } from 'react';
import { Card, Tabs, Tab, Button, Spinner } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useError } from '@/contexts/ErrorContext';
import type { FreightOrder } from '@/types/freight';
import { useAuth } from '@/contexts/AuthContext';
import { OrderTable } from '@/components/freight/OrderTable';
import TablePlaceholder from '@/components/TablePlaceholder';
import { FileText } from 'lucide-react';

const fetchFreightOrders = async (): Promise<FreightOrder[]> => {
  const { data, error } = await supabase.functions.invoke('get-freight-orders');
  if (error) throw new Error(error.message);
  return data.orders;
};

const Fernverkehr = () => {
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const queryClient = useQueryClient();
  const { addError } = useError();
  const { hasPermission } = useAuth();
  const canBill = hasPermission('Abrechnung Fernverkehr');

  const { data: orders, isLoading, error } = useQuery<FreightOrder[]>({
    queryKey: ['freightOrders'],
    queryFn: fetchFreightOrders,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async ({ orderIds, customerId }: { orderIds: number[], customerId: number }) => {
      const { data, error } = await supabase.functions.invoke('create-lexoffice-invoice', {
        body: { orderIds, customerId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message || "Rechnungsentwurf erfolgreich in Lexoffice erstellt!");
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
      setSelectedOrderIds([]);
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || "Fehler beim Erstellen des Rechnungsentwurfs.");
    },
  });

  const handleCreateCollectiveInvoice = () => {
    if (selectedOrderIds.length === 0) return;

    const selectedOrders = orders?.filter(o => selectedOrderIds.includes(o.id)) || [];
    if (selectedOrders.length === 0) return;

    const firstCustomerId = selectedOrders[0].customer_id;
    const allSameCustomer = selectedOrders.every(o => o.customer_id === firstCustomerId);

    if (!allSameCustomer) {
      showError("Bitte wählen Sie nur Aufträge für denselben Kunden aus.");
      return;
    }
    
    if (!firstCustomerId) {
        showError("Ausgewählten Aufträgen ist kein Kunde zugewiesen.");
        return;
    }

    createInvoiceMutation.mutate({ orderIds: selectedOrderIds, customerId: firstCustomerId });
  };

  const handleSelectionChange = (orderId: number) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
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
        <Button onClick={handleCreateCollectiveInvoice} disabled={selectedOrderIds.length === 0 || createInvoiceMutation.isPending}>
          {createInvoiceMutation.isPending ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
              <span className="ms-2">Erstelle Entwurf...</span>
            </>
          ) : (
            <>
              <FileText className="me-2" size={16} />
              Rechnungsentwurf erstellen ({selectedOrderIds.length})
            </>
          )}
        </Button>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Abrechnungsübersicht</Card.Title>
          <Card.Text className="text-muted">Hier sehen Sie alle offenen und bereits abgerechneten Aufträge.</Card.Text>
        </Card.Header>
        <Card.Body>
          <Tabs defaultActiveKey="open" id="billing-tabs" className="mb-3 nav-fill">
            <Tab eventKey="open" title="Offene Abrechnungen">
              {isLoading ? <TablePlaceholder cols={tableCols} /> : <OrderTable orders={openBillings} onDelete={() => {}} showBillingColumn={canBill} isBillingContext={true} selectedIds={selectedOrderIds} onSelectionChange={handleSelectionChange} />}
            </Tab>
            <Tab eventKey="archive" title="Archiv">
              {isLoading ? <TablePlaceholder cols={tableCols} /> : <OrderTable orders={archivedBillings} onDelete={() => {}} showBillingColumn={canBill} isBillingContext={true} />}
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Fernverkehr;