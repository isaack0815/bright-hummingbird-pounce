import { useState, useMemo } from 'react';
import { Card, Table, Spinner, Badge } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { NavLink } from 'react-router-dom';
import { ArrowUp, ArrowDown } from 'lucide-react';

type Order = {
  id: number;
  order_number: string;
  status: string;
  pickup_date: string | null;
  delivery_date: string | null;
  customers: { company_name: string } | null;
};

const fetchOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase.functions.invoke('get-dashboard-freight-orders');
  if (error) throw new Error(error.message);
  return data.orders;
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'Angelegt':
      return 'secondary';
    case 'Geplant':
      return 'info';
    case 'Unterwegs':
      return 'warning';
    case 'Zugestellt':
      return 'success';
    case 'Storniert':
      return 'danger';
    default:
      return 'light';
  }
};

export function FreightOrderWidget() {
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['dashboardFreightOrders'],
    queryFn: fetchOrders,
  });

  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'ascending' | 'descending' } | null>(null);

  const sortedOrders = useMemo(() => {
    let sortableItems = [...(orders || [])];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null) return 1;
        if (bValue === null) return -1;
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    } else {
      // Default sort: status primary, pickup_date secondary
      const statusOrder: { [key: string]: number } = {
        'Unterwegs': 1,
        'Geplant': 2,
        'Angelegt': 3,
        'Zugestellt': 4,
        'Storniert': 5,
      };
      sortableItems.sort((a, b) => {
        const statusA = statusOrder[a.status] || 99;
        const statusB = statusOrder[b.status] || 99;

        if (statusA !== statusB) {
          return statusA - statusB;
        }

        const dateA = a.pickup_date ? new Date(a.pickup_date).getTime() : Infinity;
        const dateB = b.pickup_date ? new Date(b.pickup_date).getTime() : Infinity;
        
        if (dateA !== dateB) {
          return dateA - dateB;
        }

        return 0;
      });
    }
    return sortableItems;
  }, [orders, sortConfig]);

  const requestSort = (key: keyof Order) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Order) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp size={14} className="ms-1" /> : <ArrowDown size={14} className="ms-1" />;
  };

  return (
    <Card className="h-100">
      <Card.Header>
        <Card.Title as="h6" className="mb-0">Letzte Frachtaufträge</Card.Title>
      </Card.Header>
      <Card.Body style={{ overflowY: 'auto', maxHeight: '400px' }}>
        {isLoading ? (
          <div className="text-center"><Spinner animation="border" size="sm" /></div>
        ) : sortedOrders.length > 0 ? (
          <Table responsive hover size="sm">
            <thead>
              <tr>
                <th onClick={() => requestSort('order_number')} className="cursor-pointer">Auftragsnr. {getSortIcon('order_number')}</th>
                <th onClick={() => requestSort('customers')} className="cursor-pointer">Kunde {getSortIcon('customers')}</th>
                <th onClick={() => requestSort('pickup_date')} className="cursor-pointer">Abholung {getSortIcon('pickup_date')}</th>
                <th onClick={() => requestSort('delivery_date')} className="cursor-pointer">Lieferung {getSortIcon('delivery_date')}</th>
                <th onClick={() => requestSort('status')} className="cursor-pointer">Status {getSortIcon('status')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map(order => (
                <tr key={order.id}>
                  <td className="fw-medium">
                    <NavLink to={`/freight-orders/edit/${order.id}`}>{order.order_number}</NavLink>
                  </td>
                  <td>{order.customers?.company_name || '-'}</td>
                  <td>{order.pickup_date ? new Date(order.pickup_date).toLocaleDateString('de-DE') : '-'}</td>
                  <td>{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('de-DE') : '-'}</td>
                  <td><Badge bg={getStatusBadgeVariant(order.status)}>{order.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-muted text-center">Keine Aufträge gefunden.</p>
        )}
      </Card.Body>
    </Card>
  );
}