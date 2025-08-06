import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { NavLink } from 'react-router-dom';
import { ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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

export function FreightOrderWidget() {
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['dashboardFreightOrders'],
    queryFn: fetchOrders,
  });

  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'ascending' | 'descending' } | null>({ key: 'pickup_date', direction: 'ascending' });

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
    return sortConfig.direction === 'ascending' ? <ArrowUp size={14} className="ml-1 inline" /> : <ArrowDown size={14} className="ml-1 inline" />;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Letzte Frachtaufträge</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : sortedOrders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => requestSort('order_number')} className="cursor-pointer">Auftragsnr. {getSortIcon('order_number')}</TableHead>
                <TableHead onClick={() => requestSort('customers')} className="cursor-pointer">Kunde {getSortIcon('customers')}</TableHead>
                <TableHead onClick={() => requestSort('pickup_date')} className="cursor-pointer">Abholung {getSortIcon('pickup_date')}</TableHead>
                <TableHead onClick={() => requestSort('status')} className="cursor-pointer">Status {getSortIcon('status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <NavLink to={`/freight-orders/edit/${order.id}`} className="text-primary hover:underline">{order.order_number}</NavLink>
                  </TableCell>
                  <TableCell>{order.customers?.company_name || '-'}</TableCell>
                  <TableCell>{order.pickup_date ? new Date(order.pickup_date).toLocaleDateString('de-DE') : '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{order.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center">Keine Aufträge gefunden.</p>
        )}
      </CardContent>
    </Card>
  );
}