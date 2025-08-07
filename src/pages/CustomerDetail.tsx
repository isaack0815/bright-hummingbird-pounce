import { useMemo } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, Alert, Tabs, Tab, Table } from 'react-bootstrap';
import { ArrowLeft, BarChart2, FileText, Truck, Euro } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { CustomerDetails } from '@/types/customer';
import { OrderTable } from '@/components/freight/OrderTable';
import { StatCard } from '@/components/customer/StatCard';

const fetchCustomerDetails = async (id: string): Promise<CustomerDetails> => {
  const { data, error } = await supabase.functions.invoke('get-customer-details', { body: { id: parseInt(id, 10) } });
  if (error) throw error;
  return data;
};

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: customerData, isLoading: isLoadingCustomer, error: customerError } = useQuery({
    queryKey: ['customerDetails', id],
    queryFn: () => fetchCustomerDetails(id!),
    enabled: !!id,
  });

  const { revenueData, totalRevenue, totalOrders, openRevenue, billedOrdersCount } = useMemo(() => {
    if (!customerData?.orders) return { revenueData: [], totalRevenue: 0, totalOrders: 0, openRevenue: 0, billedOrdersCount: 0 };
    
    const billedOrders = customerData.orders.filter(o => o.is_billed && o.price);
    const openOrders = customerData.orders.filter(o => !o.is_billed && o.price);
    
    const monthlyRevenue = billedOrders.reduce((acc, order) => {
      const month = format(parseISO(order.created_at), 'MMM yyyy', { locale: de });
      acc[month] = (acc[month] || 0) + order.price!;
      return acc;
    }, {} as Record<string, number>);

    const revenueData = Object.entries(monthlyRevenue)
      .map(([month, umsatz]) => ({ month, umsatz }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    const totalRevenue = billedOrders.reduce((sum, o) => sum + o.price!, 0);
    const openRevenue = openOrders.reduce((sum, o) => sum + o.price!, 0);

    return { revenueData, totalRevenue, totalOrders: customerData.orders.length, openRevenue, billedOrdersCount: billedOrders.length };
  }, [customerData]);

  if (isLoadingCustomer) return <Container><p>Lade Kundendaten...</p></Container>;
  if (customerError) return <Container><Alert variant="danger">Fehler: {customerError.message}</Alert></Container>;
  if (!customerData) return <Container><Alert variant="warning">Kunde nicht gefunden.</Alert></Container>;

  const { customer, orders } = customerData;
  const billedOrders = orders.filter(o => o.is_billed);
  const unbilledOrders = orders.filter(o => !o.is_billed);

  return (
    <Container fluid>
      <div className="d-flex align-items-center gap-3 mb-4">
        <NavLink to="/customers" className="btn btn-outline-secondary p-2 lh-1"><ArrowLeft size={16} /></NavLink>
        <h1 className="h2 mb-0">{customer.company_name}</h1>
      </div>

      <Row className="g-4 mb-4">
        <Col md={3}><StatCard title="Gesamtumsatz (abgerechnet)" value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalRevenue)} icon={<Euro />} isLoading={isLoadingCustomer} /></Col>
        <Col md={3}><StatCard title="Offener Umsatz" value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(openRevenue)} icon={<FileText />} isLoading={isLoadingCustomer} /></Col>
        <Col md={3}><StatCard title="Anzahl Aufträge" value={String(totalOrders)} icon={<Truck />} isLoading={isLoadingCustomer} /></Col>
        <Col md={3}><StatCard title="Abgerechnete Aufträge" value={String(billedOrdersCount)} icon={<FileText />} isLoading={isLoadingCustomer} /></Col>
      </Row>

      <Card className="mb-4">
        <Card.Header><Card.Title className="d-flex align-items-center"><BarChart2 className="me-2" />Umsatzentwicklung (abgerechnet)</Card.Title></Card.Header>
        <Card.Body>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value as number)} />
              <Tooltip formatter={(value) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value as number)} />
              <Legend />
              <Bar dataKey="umsatz" fill="#0d6efd" name="Umsatz (Netto)" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>

      <Tabs defaultActiveKey="billed-orders" className="mb-3 nav-fill">
        <Tab eventKey="billed-orders" title="Abgerechnete Aufträge">
          <Card>
            <Card.Body>
              {billedOrders.length > 0 ? (
                <Table responsive hover>
                  <thead><tr><th>Auftragsnr.</th><th>Rechnungsnr. (Lex)</th><th>Lieferdatum</th><th>Betrag (Netto)</th></tr></thead>
                  <tbody>
                    {billedOrders.map(order => (
                      <tr key={order.id}>
                        <td className="fw-medium"><NavLink to={`/billing/${order.id}`}>{order.order_number}</NavLink></td>
                        <td>{order.lex_invoice_id || '-'}</td>
                        <td>{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('de-DE') : '-'}</td>
                        <td>{order.price ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(order.price) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-muted text-center py-4">Keine abgerechneten Aufträge für diesen Kunden.</p>
              )}
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="open-orders" title="Offene Aufträge">
          <Card>
            <Card.Body>
              <OrderTable orders={unbilledOrders} onDelete={() => {}} showBillingColumn={false} />
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default CustomerDetail;