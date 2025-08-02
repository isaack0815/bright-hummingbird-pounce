import { Table, Dropdown, Button, Badge } from "react-bootstrap";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { FreightOrder } from "@/types/freight";
import { differenceInCalendarDays, parseISO } from 'date-fns';

type OrderTableProps = {
  orders: FreightOrder[];
  onDelete: (id: number) => void;
};

export const OrderTable = ({ orders, onDelete }: OrderTableProps) => {
  const navigate = useNavigate();

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

  if (orders.length === 0) {
    return <p className="text-muted text-center py-5">Keine Aufträge in dieser Ansicht gefunden.</p>;
  }

  return (
    <Table responsive hover>
      <thead>
        <tr>
          <th>Auftragsnr.</th>
          <th>Kunde</th>
          <th>Status</th>
          <th>Von</th>
          <th>Nach</th>
          <th>Abholdatum</th>
          <th className="text-end">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id} className={getRowClass(order)}>
            <td className="fw-medium">{order.order_number}</td>
            <td>{order.customers?.company_name || 'N/A'}</td>
            <td><Badge bg="secondary">{order.status}</Badge></td>
            <td>{order.origin_address}</td>
            <td>{order.destination_address}</td>
            <td>{order.pickup_date ? new Date(order.pickup_date).toLocaleDateString() : '-'}</td>
            <td className="text-end">
              <Dropdown renderOnMount align="end">
                <Dropdown.Toggle as={Button} variant="ghost" size="sm" id={`dropdown-order-${order.id}`}>
                  <MoreHorizontal size={16} />
                </Dropdown.Toggle>
                <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                  <Dropdown.Item onClick={() => navigate(`/freight-orders/edit/${order.id}`)}>
                    <Edit className="me-2" size={16} />
                    Bearbeiten
                  </Dropdown.Item>
                  <Dropdown.Item
                    className="text-danger"
                    onClick={() => onDelete(order.id)}
                  >
                    <Trash2 className="me-2" size={16} />
                    Löschen
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};