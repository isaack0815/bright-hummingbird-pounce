import { Table, Button, Badge, Form } from "react-bootstrap";
import { Edit, Trash2, XCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { FreightOrder } from "@/types/freight";
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showError } from '@/utils/toast';

type OrderTableProps = {
  orders: FreightOrder[];
  onDelete: (id: number) => void;
  showBillingColumn: boolean;
  isBillingContext?: boolean;
  selectedIds?: number[];
  onSelectionChange?: (id: number) => void;
};

export const OrderTable = ({ orders, onDelete, showBillingColumn, isBillingContext = false, selectedIds = [], onSelectionChange }: OrderTableProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const toggleBilledMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase.rpc('toggle_order_billed_status', { p_order_id: orderId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Ändern des Abrechnungsstatus.");
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
    }
  });

  const getRowClass = (order: FreightOrder): string => {
    if (order.status !== 'Angelegt' || !order.pickup_date) {
      return '';
    }

    try {
      const pickupDate = parseISO(order.pickup_date);
      const today = new Date();
      const daysUntilPickup = differenceInCalendarDays(pickupDate, today);

      if (daysUntilPickup <= 0) {
        return 'table-danger';
      }
      if (daysUntilPickup <= 7) {
        return 'table-warning';
      }
    } catch (e) {
      console.error("Error parsing date for order:", order.id, order.pickup_date, e);
      return '';
    }

    return '';
  };

  const handleEditClick = (orderId: number) => {
    const path = isBillingContext ? `/billing/${orderId}` : `/freight-orders/edit/${orderId}`;
    navigate(path);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      orders.forEach(order => {
        if (!selectedIds.includes(order.id) && order.customer_id && order.price) {
          onSelectionChange?.(order.id);
        }
      });
    } else {
      orders.forEach(order => {
        if (selectedIds.includes(order.id)) {
          onSelectionChange?.(order.id);
        }
      });
    }
  };

  if (orders.length === 0) {
    return <p className="text-muted text-center py-5">Keine Aufträge in dieser Ansicht gefunden.</p>;
  }

  return (
    <Table responsive hover>
      <thead>
        <tr>
          {isBillingContext && (
            <th className="text-center align-middle">
              <Form.Check 
                type="checkbox"
                onChange={handleSelectAll}
                checked={orders.length > 0 && orders.every(o => selectedIds.includes(o.id) || !o.customer_id || !o.price)}
              />
            </th>
          )}
          <th>Ladeort</th>
          <th>Entladeort</th>
          <th>Auftragsnr.</th>
          <th>Auftraggeber</th>
          <th>Status</th>
          <th>Abholdatum</th>
          <th>Lieferdatum</th>
          {showBillingColumn && <th className="text-center">Abgerechnet</th>}
          <th>Bearbeiter</th>
          <th className="text-end">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id} className={getRowClass(order)}>
            {isBillingContext && (
              <td className="text-center align-middle">
                <Form.Check 
                  type="checkbox"
                  checked={selectedIds.includes(order.id)}
                  onChange={() => onSelectionChange?.(order.id)}
                  disabled={!order.customer_id || !order.price}
                />
              </td>
            )}
            <td>{order.origin_address}</td>
            <td>{order.destination_address}</td>
            <td className="fw-medium">{order.order_number}</td>
            <td>{order.customers?.company_name || 'N/A'}</td>
            <td><Badge bg="secondary">{order.status}</Badge></td>
            <td>{order.pickup_date ? new Date(order.pickup_date).toLocaleDateString('de-DE') : '-'}</td>
            <td>{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('de-DE') : '-'}</td>
            {showBillingColumn && (
              <td className="text-center align-middle">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => toggleBilledMutation.mutate(order.id)}
                  disabled={toggleBilledMutation.isPending && toggleBilledMutation.variables === order.id}
                  className="p-0 text-decoration-none"
                >
                  {toggleBilledMutation.isPending && toggleBilledMutation.variables === order.id ? (
                    <Loader2 size={20} />
                  ) : order.is_billed ? (
                    <CheckCircle2 size={20} className="text-success" />
                  ) : (
                    <XCircle size={20} className="text-danger" />
                  )}
                </Button>
              </td>
            )}
            <td>{order.creator ? `${order.creator.first_name || ''} ${order.creator.last_name || ''}`.trim() : 'N/A'}</td>
            <td className="text-end">
              <div className="d-flex justify-content-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleEditClick(order.id)}>
                  <Edit size={16} />
                </Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => onDelete(order.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};