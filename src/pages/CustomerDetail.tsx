import { useState, useMemo } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, Button, Spinner, Alert, Tabs, Tab, Table, Badge, Placeholder } from 'react-bootstrap';
import { ArrowLeft, Download, BarChart2, FileText, Truck, Euro } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { showError } from '@/utils/toast';
import type { CustomerDetails, LexInvoice } from '@/types/customer';
import { OrderTable } from '@/components/freight/OrderTable';
import { StatCard } from '@/components/customer/StatCard';

const fetchCustomerDetails = async (id: string): Promise<CustomerDetails> => {
  const { data, error } = await supabase.functions.invoke('get-customer-details', { body: { id: parseInt(id, 10) } });
  if (error) throw error;
  return data;
};

const fetchLexInvoices = async (lexContactId: string): Promise<LexInvoice[]> => {
  const { data, error } = await supabase.functions.invoke('get-lexoffice-invoices-by-customer', { body: { lexContactId } });
  if (error) throw error;
  return data.invoices;
};

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: customerData, isLoading: isLoadingCustomer, error: customerError } = useQuery({
    queryKey: ['customerDetails', id],
    queryFn: () => fetchCustomerDetails(id!),
    enabled: !!id,
  });

  const { data: invoices, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['lexInvoices', customerData?.customer.lex_id],
    queryFn: () => fetchLexInvoices(customerData!.customer.lex_id!),
    enabled: !!customerData?.customer.lex_id,
  });

  const { revenueData, totalRevenue, totalOrders, openInvoiceAmount } = useMemo(() => {
    if (!customerData?.orders) return { revenueData: [], totalRevenue: 0, totalOrders: 0, openInvoiceAmount: 0 };
    
    const billedOrders = customerData.orders.filter(o => o.is_billed && o.price);
    
    const monthlyRevenue = billedOrders.reduce((acc, order) => {
      const month = format(parseISO(order.created_at), 'MMM yyyy', { locale: de });
      acc[month] = (acc[month] || 0) + order.price!;
      return acc;
    }, {} as Record<string, number>);

    const revenueData = Object.entries(monthlyRevenue)
      .map(([month, umsatz]) => ({ month, umsatz }))
      .sort((a, b) => parseISO(a.month).getTime() - parseISO(b.month).getTime());

    const totalRevenue = billedOrders.reduce((sum, o) => sum + o.price!, 0);
    const openInvoices = invoices?.filter(inv => inv.voucherStatus === 'open' || inv.voucherStatus === 'overdue');
    const openInvoiceAmount = openInvoices?.reduce((sum, inv) => sum + (inv.totalPrice?.totalGrossAmount || 0), 0) || 0;

    return { revenueData, totalRevenue, totalOrders: customerData.orders.length, openInvoiceAmount };
  }, [customerData, invoices]);

  const handleDownload = async (invoice: LexInvoice) => {
    setDownloadingId(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('get-lexoffice-invoice-pdf', { body: { invoiceId: invoice.id } });
      if (error) throw error;
      if (data instanceof Blob) {
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rechnung-${invoice.voucherNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error("Die Antwort war kein gültiges PDF.");
      }
    } catch (err: any) {
      showError(err.data?.error || err.message || "Fehler beim Herunterladen.");
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'open': return 'primary';
      case 'overdue': return 'warning';
      case 'voided': return 'danger';
      default: return 'secondary';
    }
  };

  if (isLoadingCustomer) return <Container><p>Lade Kundendaten...</p></Container>;
  if (customerError) return <Container><Alert variant="danger">Fehler: {customerError.message}</Alert></Container>;
  if (!customerData) return <Container><Alert variant="warning">Kunde nicht gefunden.</Alert></Container>;

  const { customer, orders } = customerData;

  return (
    <Container fluid>
      <div className="d-flex align-items-center gap-3 mb-4">
        <NavLink to="/customers" className="btn btn-outline-secondary p-2 lh-1"><ArrowLeft size={16} /></NavLink>
        <h1 className="h2 mb-0">{customer.company_name}</h1>
      </div>

      <Row className="g-4 mb-4">
        <Col md={3}><StatCard title="Gesamtumsatz" value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalRevenue)} icon={<Euro />} isLoading={isLoadingCustomer} /></Col>
        <Col md={3}><StatCard title="Offene Rechnungen" value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(openInvoiceAmount)} icon={<FileText />} isLoading={isLoadingInvoices} /></Col>
        <Col md={3}><StatCard title="Anzahl Aufträge" value={String(totalOrders)} icon={<Truck />} isLoading={isLoadingCustomer} /></Col>
        <Col md={3}><StatCard title="Anzahl Rechnungen" value={String(invoices?.length || 0)} icon={<FileText />} isLoading={isLoadingInvoices} /></Col>
      </Row>

      <Card className="mb-4">
        <Card.Header><Card.Title className="d-flex align-items-center"><BarChart2 className="me-2" />Umsatzentwicklung</Card.Title></Card.Header>
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

      <Tabs defaultActiveKey="invoices" className="mb-3 nav-fill">
        <Tab eventKey="invoices" title="Rechnungen">
          <Card>
            <Card.Body>
              {isLoadingInvoices ? <Placeholder as="div" animation="glow"><Placeholder xs={12} style={{height: '200px'}} /></Placeholder> : (
                <Table responsive hover>
                  <thead><tr><th>Rechnungsnr.</th><th>Datum</th><th>Status</th><th>Betrag (Brutto)</th><th className="text-end">Aktion</th></tr></thead>
                  <tbody>
                    {invoices?.map(invoice => (
                      <tr key={invoice.id}>
                        <td className="fw-medium">{invoice.voucherNumber}</td>
                        <td>{new Date(invoice.voucherDate).toLocaleDateString('de-DE')}</td>
                        <td><Badge bg={getStatusBadge(invoice.voucherStatus)}>{invoice.voucherStatus}</Badge></td>
                        <td>{invoice.totalPrice ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: invoice.totalPrice.currency }).format(invoice.totalPrice.totalGrossAmount) : '-'}</td>
                        <td className="text-end">
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(invoice)} disabled={downloadingId === invoice.id}>
                            {downloadingId === invoice.id ? <Spinner size="sm" /> : <Download size={16} />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="orders" title="Aufträge">
          <Card>
            <Card.Body>
              <OrderTable orders={orders} onDelete={() => {}} showBillingColumn={false} />
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default CustomerDetail;