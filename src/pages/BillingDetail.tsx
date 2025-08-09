import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, NavLink } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { Card, Row, Col, Button, ListGroup, Alert, Form, InputGroup, Spinner, Table } from 'react-bootstrap';
import { ArrowLeft, Save, PlusCircle, Trash2, FileUp, FileCheck2, Download } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import type { FreightOrder } from '@/types/freight';
import type { Customer } from '@/pages/CustomerManagement';
import type { BillingLineItem } from '@/types/billing';
import { useEffect, useState, useMemo } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';

type BillingOrder = Omit<FreightOrder, 'customers'> & {
  customers: Customer | null;
  line_items: BillingLineItem[];
  external_invoice_receipt_date?: string | null;
};

const lineItemSchema = z.object({
  id: z.number().optional(),
  description: z.string().min(1, "Erforderlich"),
  quantity: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  discount_type: z.enum(['fixed', 'percentage']).default('fixed'),
  vat_rate: z.coerce.number().min(0),
});

const billingSchema = z.object({
  is_intra_community: z.boolean().default(false),
  total_discount: z.coerce.number().min(0).default(0),
  total_discount_type: z.enum(['fixed', 'percentage']).default('fixed'),
  line_items: z.array(lineItemSchema),
});

const fetchBillingDetails = async (id: string): Promise<BillingOrder> => {
  const { data, error } = await supabase.functions.invoke('get-billing-details', {
    body: { orderId: parseInt(id, 10) },
  });
  if (error) throw new Error(error.message);
  return data.order;
};

const fetchExternalFiles = async (orderId: string) => {
    const { data, error } = await supabase
        .from('order_files')
        .select('id, file_name, file_path')
        .eq('order_id', orderId)
        .in('file_name', [`CMR_${orderId}.pdf`, `Eingangsrechnung_${orderId}.pdf`]);
    if (error) throw error;
    return data;
}

const BillingDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [receiptDate, setReceiptDate] = useState('');
  const [cmrFile, setCmrFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadingCMR, setUploadingCMR] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['billingDetail', orderId],
    queryFn: () => fetchBillingDetails(orderId!),
    enabled: !!orderId,
  });

  const { data: externalFiles } = useQuery({
    queryKey: ['externalBillingFiles', orderId],
    queryFn: () => fetchExternalFiles(orderId!),
    enabled: !!orderId && order?.is_billed && order?.is_external,
  });

  const form = useForm<z.infer<typeof billingSchema>>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      is_intra_community: false,
      total_discount: 0,
      total_discount_type: 'fixed',
      line_items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  useEffect(() => {
    if (order) {
      const defaultLineItem = {
        description: `Transportauftrag ${order.order_number}`,
        quantity: 1,
        unit_price: order.price || 0,
        discount: 0,
        discount_type: 'fixed' as 'fixed' | 'percentage',
        vat_rate: order.vat_rate ?? 19,
      };
      form.reset({
        is_intra_community: order.is_intra_community || false,
        total_discount: order.total_discount || 0,
        total_discount_type: (order.total_discount_type as 'fixed' | 'percentage') || 'fixed',
        line_items: order.line_items && order.line_items.length > 0 ? order.line_items : [defaultLineItem],
      });
      setReceiptDate(order.external_invoice_receipt_date || '');
    }
  }, [order, form]);

  const updateReceiptDateMutation = useMutation({
    mutationFn: async (date: string) => {
        const { error } = await supabase.functions.invoke('update-invoice-receipt-date', {
            body: { orderId: order!.id, receiptDate: date }
        });
        if (error) throw error;
    },
    onSuccess: () => {
        showSuccess("Rechnungseingang gespeichert!");
        queryClient.invalidateQueries({ queryKey: ['billingDetail', orderId] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern des Datums.")
  });

  const handleFileUpload = async (file: File, type: 'CMR' | 'Invoice') => {
    if (!file || !orderId || !user) return;
    const setLoading = type === 'CMR' ? setUploadingCMR : setUploadingInvoice;
    setLoading(true);
    try {
        const fileName = `${type}_${orderId}.pdf`;
        const filePath = `${orderId}/${uuidv4()}-${fileName}`;
        
        const { error: uploadError } = await supabase.storage.from('order-files').upload(filePath, file, { upsert: true });
        if (uploadError) throw uploadError;

        await supabase.from('order_files').upsert({
            order_id: orderId,
            user_id: user.id,
            file_path: filePath,
            file_name: fileName,
            file_type: file.type,
        }, { onConflict: 'order_id,file_name' });

        showSuccess(`${type} erfolgreich hochgeladen!`);
        queryClient.invalidateQueries({ queryKey: ['externalBillingFiles', orderId] });
    } catch (err: any) {
        showError(err.message || "Fehler beim Upload.");
    } finally {
        setLoading(false);
    }
  };

  const createLexofficeInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!order || !order.customers) {
        throw new Error("Auftrags- oder Kundendaten fehlen.");
      }
      const { data, error } = await supabase.functions.invoke('create-lexoffice-invoice', {
        body: { orderIds: [order.id], customerId: order.customers.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message || "Rechnungsentwurf erfolgreich in Lexoffice erstellt!");
      queryClient.invalidateQueries({ queryKey: ['billingDetail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
    },
    onError: (err: any) => {
      showError(err.data?.error || "Fehler beim Erstellen des Rechnungsentwurfs.");
    }
  });

  const updateBillingMutation = useMutation({
    mutationFn: async (values: z.infer<typeof billingSchema>) => {
      const { error } = await supabase.functions.invoke('update-billing-with-line-items', {
        body: {
          orderId: order!.id,
          orderData: {
            is_intra_community: values.is_intra_community,
            total_discount: values.total_discount,
            total_discount_type: values.total_discount_type,
          },
          lineItems: values.line_items,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Abrechnungsdetails zwischengespeichert!");
      createLexofficeInvoiceMutation.mutate();
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Speichern der Details.");
    }
  });

  const watchedLineItems = form.watch('line_items');
  const watchedTotalDiscount = form.watch('total_discount');
  const watchedTotalDiscountType = form.watch('total_discount_type');
  const watchedIsIntraCommunity = form.watch('is_intra_community');

  const totals = useMemo(() => watchedLineItems.reduce((acc, item) => {
    const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
    let lineDiscount = 0;
    if (item.discount_type === 'fixed') {
      lineDiscount = item.discount || 0;
    } else {
      lineDiscount = lineTotal * ((item.discount || 0) / 100);
    }
    const netLineTotal = lineTotal - lineDiscount;
    const vatAmount = netLineTotal * ((item.vat_rate || 0) / 100);
    
    acc.subtotal += lineTotal;
    acc.totalNet += netLineTotal;
    
    if (!acc.vatTotals[item.vat_rate || 0]) {
      acc.vatTotals[item.vat_rate || 0] = 0;
    }
    acc.vatTotals[item.vat_rate || 0] += vatAmount;
    
    return acc;
  }, { subtotal: 0, totalNet: 0, vatTotals: {} as Record<number, number> }), [watchedLineItems]);

  const { finalNet, finalGross } = useMemo(() => {
    let overallDiscountAmount = 0;
    if (watchedTotalDiscountType === 'fixed') {
      overallDiscountAmount = watchedTotalDiscount || 0;
    } else {
      overallDiscountAmount = totals.totalNet * ((watchedTotalDiscount || 0) / 100);
    }
    const finalNet = totals.totalNet - overallDiscountAmount;
    const totalVat = Object.values(totals.vatTotals).reduce((sum, v) => sum + v, 0);
    const finalGross = finalNet + totalVat;
    return { finalNet, finalGross };
  }, [totals, watchedTotalDiscount, watchedTotalDiscountType]);

  const paymentDueDate = useMemo(() => {
    if (receiptDate && order?.payment_term_days) {
        try {
            return format(addDays(parseISO(receiptDate), order.payment_term_days), 'dd.MM.yyyy');
        } catch {
            return 'Ungültiges Datum';
        }
    }
    return '-';
  }, [receiptDate, order?.payment_term_days]);

  const existingCmr = externalFiles?.find(f => f.file_name.startsWith('CMR_'));
  const existingInvoice = externalFiles?.find(f => f.file_name.startsWith('Eingangsrechnung_'));

  if (isLoading) return <p>Lade Abrechnungsdetails...</p>;
  if (error) return <Alert variant="danger">Fehler: {error.message}</Alert>;
  if (!order) return <Alert variant="warning">Auftrag nicht gefunden.</Alert>;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className='d-flex align-items-center gap-3'>
          <NavLink to="/fernverkehr" className="btn btn-outline-secondary btn-sm p-2 lh-1"><ArrowLeft size={16} /></NavLink>
          <h1 className="h2 mb-0">Abrechnung für Auftrag {order.order_number}</h1>
        </div>
        {!order.is_billed && (
            <Button form="billing-form" type="submit" disabled={updateBillingMutation.isPending || createLexofficeInvoiceMutation.isPending}>
                {updateBillingMutation.isPending ? <Spinner size="sm" className="me-2" /> : <Save size={16} className="me-2" />}
                {createLexofficeInvoiceMutation.isPending ? 'Erstelle Entwurf...' : 'Speichern & Lexoffice-Entwurf erstellen'}
            </Button>
        )}
      </div>

      <Form id="billing-form" onSubmit={form.handleSubmit((v) => updateBillingMutation.mutate(v))}>
        <Row className="g-4">
            <Col lg={8}>
                <Card>
                    <Card.Header><Card.Title>Rechnungspositionen</Card.Title></Card.Header>
                    <Card.Body>
                        <Table responsive>
                            <thead><tr><th>Beschreibung</th><th>Menge</th><th>Einzelpreis</th><th>Rabatt</th><th>MwSt.</th><th></th></tr></thead>
                            <tbody>
                            {fields.map((field, index) => (
                                <tr key={field.id}>
                                <td><Form.Control {...form.register(`line_items.${index}.description`)} disabled={order.is_billed} /></td>
                                <td><Form.Control type="number" {...form.register(`line_items.${index}.quantity`)} disabled={order.is_billed} /></td>
                                <td><InputGroup><Form.Control type="number" step="0.01" {...form.register(`line_items.${index}.unit_price`)} disabled={order.is_billed} /><InputGroup.Text>€</InputGroup.Text></InputGroup></td>
                                <td>
                                    <InputGroup>
                                    <Form.Control type="number" step="0.01" {...form.register(`line_items.${index}.discount`)} disabled={order.is_billed} />
                                    <Form.Select {...form.register(`line_items.${index}.discount_type`)} style={{width: '60px'}} disabled={order.is_billed}><option value="fixed">€</option><option value="percentage">%</option></Form.Select>
                                    </InputGroup>
                                </td>
                                <td>
                                    <Controller
                                    control={form.control}
                                    name={`line_items.${index}.vat_rate`}
                                    render={({ field }) => (
                                        <Form.Select {...field} disabled={watchedIsIntraCommunity || order.is_billed}>
                                        <option value="19">19%</option><option value="7">7%</option><option value="0">0%</option>
                                        </Form.Select>
                                    )}
                                    />
                                </td>
                                <td>{!order.is_billed && <Button variant="ghost" size="sm" onClick={() => remove(index)}><Trash2 className="text-danger" size={16} /></Button>}</td>
                                </tr>
                            ))}
                            </tbody>
                        </Table>
                        {!order.is_billed && <Button variant="outline-secondary" onClick={() => append({ description: '', quantity: 1, unit_price: 0, discount: 0, discount_type: 'fixed', vat_rate: 19 })}>
                            <PlusCircle size={16} className="me-2" />Position hinzufügen
                        </Button>}
                    </Card.Body>
                </Card>
            </Col>
            <Col lg={4}>
                <Card className="mb-4">
                    <Card.Header><Card.Title>Rechnungsanschrift</Card.Title></Card.Header>
                    <Card.Body>
                    <p className="mb-1"><strong>{order.customers?.company_name}</strong></p>
                    <p className="text-muted small">{order.customers?.street} {order.customers?.house_number}<br/>{order.customers?.postal_code} {order.customers?.city}</p>
                    </Card.Body>
                </Card>
                <Card>
                    <Card.Header><Card.Title>Zusammenfassung</Card.Title></Card.Header>
                    <Card.Body>
                    <ListGroup variant="flush">
                        <ListGroup.Item className="d-flex justify-content-between"><span>Zwischensumme</span> <span>{totals.subtotal.toFixed(2)} €</span></ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between"><span>Gesamtrabatt</span>
                        <InputGroup size="sm" style={{maxWidth: '150px'}}>
                            <Form.Control type="number" step="0.01" {...form.register('total_discount')} disabled={order.is_billed} />
                            <Form.Select {...form.register('total_discount_type')} style={{width: '60px'}} disabled={order.is_billed}><option value="fixed">€</option><option value="percentage">%</option></Form.Select>
                        </InputGroup>
                        </ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between"><strong>Summe Netto</strong> <strong>{finalNet.toFixed(2)} €</strong></ListGroup.Item>
                        {Object.entries(totals.vatTotals).map(([rate, amount]) => (
                        <ListGroup.Item key={rate} className="d-flex justify-content-between"><span>+ MwSt. ({rate}%)</span> <span>{amount.toFixed(2)} €</span></ListGroup.Item>
                        ))}
                        <ListGroup.Item className="d-flex justify-content-between fw-bold h5 mb-0"><span>Gesamt Brutto</span> <span>{finalGross.toFixed(2)} €</span></ListGroup.Item>
                    </ListGroup>
                    <hr/>
                    <Form.Check type="switch" id="intra-community-switch" label="Innergemeinschaftliche Leistung" {...form.register('is_intra_community')} disabled={order.is_billed} onChange={(e) => {
                        form.setValue('is_intra_community', e.target.checked);
                        const newVatRate = e.target.checked ? 0 : 19;
                        watchedLineItems.forEach((_, index) => {
                            form.setValue(`line_items.${index}.vat_rate`, newVatRate);
                        });
                    }}/>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
      </Form>

      {order && order.is_billed && order.is_external && (
        <Card className="mt-4">
            <Card.Header><Card.Title>Externe Abrechnungsdetails</Card.Title></Card.Header>
            <Card.Body>
                <Row className="g-4">
                    <Col md={6}>
                        <h6>Zahlungsfristen</h6>
                        <InputGroup className="mb-3">
                            <InputGroup.Text>Rechnungseingang</InputGroup.Text>
                            <Form.Control type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} />
                            <Button onClick={() => updateReceiptDateMutation.mutate(receiptDate)} disabled={!receiptDate || updateReceiptDateMutation.isPending}>
                                {updateReceiptDateMutation.isPending ? <Spinner size="sm" /> : 'Speichern'}
                            </Button>
                        </InputGroup>
                        <p className="small"><strong>Zahlungsfrist:</strong> {order.payment_term_days || '-'} Tage</p>
                        <p className="small"><strong>Zahlungsziel:</strong> {paymentDueDate}</p>
                    </Col>
                    <Col md={6}>
                        <h6>Dokumente</h6>
                        <div className="d-flex flex-column gap-3">
                            <div>
                                <Form.Label>CMR-Dokument</Form.Label>
                                {existingCmr ? (
                                    <div className="d-flex align-items-center gap-2"><FileCheck2 className="text-success" /><span className="text-muted">{existingCmr.file_name}</span><Button variant="link" size="sm"><Download /></Button></div>
                                ) : (
                                    <InputGroup>
                                        <Form.Control type="file" onChange={e => setCmrFile((e.target as HTMLInputElement).files?.[0] || null)} accept=".pdf" />
                                        <Button onClick={() => cmrFile && handleFileUpload(cmrFile, 'CMR')} disabled={!cmrFile || uploadingCMR}>{uploadingCMR ? <Spinner size="sm" /> : <FileUp />}</Button>
                                    </InputGroup>
                                )}
                            </div>
                            <div>
                                <Form.Label>Eingangsrechnung</Form.Label>
                                {existingInvoice ? (
                                    <div className="d-flex align-items-center gap-2"><FileCheck2 className="text-success" /><span className="text-muted">{existingInvoice.file_name}</span><Button variant="link" size="sm"><Download /></Button></div>
                                ) : (
                                    <InputGroup>
                                        <Form.Control type="file" onChange={e => setInvoiceFile((e.target as HTMLInputElement).files?.[0] || null)} accept=".pdf" />
                                        <Button onClick={() => invoiceFile && handleFileUpload(invoiceFile, 'Invoice')} disabled={!invoiceFile || uploadingInvoice}>{uploadingInvoice ? <Spinner size="sm" /> : <FileUp />}</Button>
                                    </InputGroup>
                                )}
                            </div>
                        </div>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
      )}
    </>
  );
};

export default BillingDetail;