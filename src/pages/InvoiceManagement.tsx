import { useState } from 'react';
import { Card, Button, Table, Badge, Spinner } from 'react-bootstrap';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showError } from '@/utils/toast';
import TablePlaceholder from '@/components/TablePlaceholder';
import type { LexInvoice } from '@/types/invoice';

const fetchInvoices = async (): Promise<LexInvoice[]> => {
  const { data, error } = await supabase.functions.invoke('get-lexoffice-invoices');
  if (error) throw new Error(error.message);
  return data.invoices;
};

const InvoiceManagement = () => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: invoices, isLoading, error } = useQuery<LexInvoice[]>({
    queryKey: ['lexofficeInvoices'],
    queryFn: fetchInvoices,
  });

  const handleDownload = async (invoice: LexInvoice) => {
    setDownloadingId(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('get-lexoffice-invoice-pdf', {
        body: { invoiceId: invoice.id },
      });

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
      showError(err.data?.error || err.message || "Fehler beim Herunterladen der Rechnung.");
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

  if (error) {
    showError(`Fehler beim Laden der Rechnungen: ${error.message}`);
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h2">Rechnungsübersicht (Lexoffice)</h1>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Alle Rechnungen</Card.Title>
          <Card.Text className="text-muted">Dies ist eine Live-Ansicht Ihrer Rechnungen aus Lexoffice.</Card.Text>
        </Card.Header>
        <Card.Body>
          {isLoading ? (
            <TablePlaceholder cols={6} />
          ) : invoices && invoices.length > 0 ? (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Rechnungsnr.</th>
                  <th>Kunde</th>
                  <th>Datum</th>
                  <th>Status</th>
                  <th>Betrag (Brutto)</th>
                  <th className="text-end">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="fw-medium">{invoice.voucherNumber}</td>
                    <td>{invoice.contactName}</td>
                    <td>{new Date(invoice.voucherDate).toLocaleDateString('de-DE')}</td>
                    <td><Badge bg={getStatusBadge(invoice.voucherStatus)}>{invoice.voucherStatus}</Badge></td>
                    <td>
                      {invoice.totalPrice ? 
                        new Intl.NumberFormat('de-DE', { style: 'currency', currency: invoice.totalPrice.currency }).format(invoice.totalPrice.totalGrossAmount)
                        : '-'
                      }
                    </td>
                    <td className="text-end">
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(invoice)} disabled={downloadingId === invoice.id}>
                        {downloadingId === invoice.id ? <Spinner size="sm" /> : <Download size={16} />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-muted text-center py-4">Keine Rechnungen in Lexoffice gefunden.</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default InvoiceManagement;