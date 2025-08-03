import { useMemo, useState } from 'react';
import { Card, Tabs, Tab, Button } from 'react-bootstrap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useError } from '@/contexts/ErrorContext';
import type { FreightOrder } from '@/types/freight';
import type { Customer } from '@/pages/CustomerManagement';
import type { Setting } from '@/types/settings';
import { useAuth } from '@/contexts/AuthContext';
import { OrderTable } from '@/components/freight/OrderTable';
import TablePlaceholder from '@/components/TablePlaceholder';
import { generateCollectiveInvoicePDF } from '@/utils/pdfGenerator';
import { FileText } from 'lucide-react';

const fetchFreightOrders = async (): Promise<FreightOrder[]> => {
  const { data, error } = await supabase.functions.invoke('get-freight-orders');
  if (error) throw new Error(error.message);
  return data.orders;
};

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase.functions.invoke('get-customers');
  if (error) throw new Error(error.message);
  return data.customers;
};

const fetchSettings = async (): Promise<Setting[]> => {
    const { data, error } = await supabase.functions.invoke('get-settings');
    if (error) throw new Error(error.message);
    return data.settings;
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

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });

  const { data: settingsArray } = useQuery<Setting[]>({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const settings = useMemo(() => {
    if (!settingsArray) return {};
    const settingsMap = new Map(settingsArray.map((s) => [s.key, s.value]));
    return Object.fromEntries(settingsMap);
  }, [settingsArray]);

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

  const handleSelectionChange = (orderId: number) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

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

    const customer = customers?.find(c => c.id === firstCustomerId);
    if (!customer) {
      showError("Kundendetails nicht gefunden.");
      return;
    }

    const pdfBlob = generateCollectiveInvoicePDF(selectedOrders, customer, settings);
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    URL.revokeObjectURL(url);
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
        <Button onClick={handleCreateCollectiveInvoice} disabled={selectedOrderIds.length === 0}>
          <FileText className="me-2" size={16} />
          Sammelrechnung erstellen ({selectedOrderIds.length})
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
              {isLoading ? <TablePlaceholder cols={tableCols} /> : <OrderTable orders={openBillings} onDelete={handleDeleteClick} showBillingColumn={canBill} isBillingContext={true} selectedIds={selectedOrderIds} onSelectionChange={handleSelectionChange} />}
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