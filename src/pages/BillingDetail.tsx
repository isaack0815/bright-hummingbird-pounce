import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, NavLink } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, Row, Col, Button, ListGroup, Placeholder, Alert, Form, InputGroup, Spinner } from 'react-bootstrap';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Save } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import type { FreightOrder } from '@/types/freight';
import type { Customer } from '@/pages/CustomerManagement';
import { useState, useEffect } from 'react';

type BillingOrder = Omit<FreightOrder, 'customers'> & {
  customers: Customer | null;
};

const fetchBillingDetails = async (id: string): Promise<BillingOrder> => {
  const { data, error } = await supabase.functions.invoke('get-billing-details', {
    body: { orderId: parseInt(id, 10) },
  });
  if (error) throw new Error(error.message);
  return data.order;
};

const BillingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [price, setPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [vatRate, setVatRate] = useState(19);
  const [isIntraCommunity, setIsIntraCommunity] = useState(false);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['billingDetail', id],
    queryFn: () => fetchBillingDetails(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (order) {
      setPrice(order.price || 0);
      setDiscount(order.discount_amount || 0);
      setVatRate(order.vat_rate ?? 19);
      setIsIntraCommunity(order.is_intra_community || false);
    }
  }, [order]);

  const updateBillingMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('update-billing-details', {
        body: {
          orderId: order!.id,
          price,
          discount_amount: discount,
          vat_rate: vatRate,
          is_intra_community: isIntraCommunity,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Abrechnungsdetails gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['billingDetail', id] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Speichern der Details.");
    }
  });

  const toggleBilledMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase.rpc('toggle_order_billed_status', { p_order_id: orderId });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Abrechnungsstatus geändert!");
      queryClient.invalidateQueries({ queryKey: ['billingDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Ändern des Abrechnungsstatus.");
    }
  });

  const handleIntraCommunityToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsIntraCommunity(checked);
    if (checked) {
      setVatRate(0);
    } else {
      setVatRate(19); // Reset to default
    }
  };

  const customer = order?.customers;
  const netAfterDiscount = price - discount;
  const vatAmount = netAfterDiscount * (vatRate / 100);
  const grossPrice = netAfterDiscount + vatAmount;

  if (isLoading) {
    return (
      <div>
        <Placeholder as="h1" animation="glow"><Placeholder xs={6} /></Placeholder>
        <Row className="g-4 mt-2">
          <Col md={6}><Placeholder as={Card} animation="glow"><Card.Body><Placeholder xs={12} style={{height: '150px'}} /></Card.Body></Placeholder></Col>
          <Col md={6}><Placeholder as={Card} animation="glow"><Card.Body><Placeholder xs={12} style={{height: '150px'}} /></Card.Body></Placeholder></Col>
        </Row>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">Fehler beim Laden der Auftragsdetails: {error.message}</Alert>;
  }

  if (!order) {
    return <Alert variant="warning">Auftrag nicht gefunden.</Alert>;
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className='d-flex align-items-center gap-3'>
          <NavLink to="/fernverkehr" className="btn btn-outline-secondary btn-sm p-2 lh-1">
            <ArrowLeft size={16} />
          </NavLink>
          <h1 className="h2 mb-0">
            Abrechnung für Auftrag {order.order_number}
          </h1>
        </div>
      </div>

      <Row className="g-4">
        <Col lg={6}>
          <Card>
            <Card.Header><Card.Title>Rechnungsanschrift</Card.Title></Card.Header>
            <Card.Body>
              {customer ? (
                <ListGroup variant="flush">
                  <ListGroup.Item><strong>Firma:</strong> {customer.company_name}</ListGroup.Item>
                  <ListGroup.Item><strong>Anschrift:</strong><br/>{customer.street} {customer.house_number}<br/>{customer.postal_code} {customer.city}<br/>{customer.country}</ListGroup.Item>
                  <ListGroup.Item><strong>E-Mail:</strong> {customer.email || '-'}</ListGroup.Item>
                  <ListGroup.Item><strong>Steuernummer:</strong> {customer.tax_number || '-'}</ListGroup.Item>
                </ListGroup>
              ) : (
                <p className="text-muted">Keine Kundendaten vorhanden.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card>
            <Card.Header><Card.Title>Preisübersicht & Bearbeitung</Card.Title></Card.Header>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label>Frachtpreis (Netto)</Form.Label>
                <InputGroup><Form.Control type="number" step="0.01" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} /><InputGroup.Text>€</InputGroup.Text></InputGroup>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Rabatt</Form.Label>
                <InputGroup><Form.Control type="number" step="0.01" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} /><InputGroup.Text>€</InputGroup.Text></InputGroup>
              </Form.Group>
              <hr />
              <ListGroup variant="flush" className="mb-3">
                <ListGroup.Item className="d-flex justify-content-between"><span>Summe (Netto)</span> <strong>{netAfterDiscount.toFixed(2)} €</strong></ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  <Form.Check type="switch" id="intra-community-switch" label="Innergemeinschaftliche Leistung" checked={isIntraCommunity} onChange={handleIntraCommunityToggle} />
                  <Form.Select size="sm" style={{width: '100px'}} value={vatRate} onChange={e => setVatRate(parseInt(e.target.value))} disabled={isIntraCommunity}>
                    <option value="19">19%</option><option value="7">7%</option><option value="0">0%</option>
                  </Form.Select>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between"><span>MwSt. ({vatRate}%)</span> <span>{vatAmount.toFixed(2)} €</span></ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between fw-bold h5 mb-0"><span>Gesamt (Brutto)</span> <span>{grossPrice.toFixed(2)} €</span></ListGroup.Item>
              </ListGroup>
              <Button variant="primary" className="w-100" onClick={() => updateBillingMutation.mutate()} disabled={updateBillingMutation.isPending}>
                {updateBillingMutation.isPending ? <Spinner size="sm" /> : <Save size={16} />} Änderungen speichern
              </Button>
            </Card.Body>
          </Card>
          <Card className="mt-4">
            <Card.Header><Card.Title>Abrechnungsstatus</Card.Title></Card.Header>
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <span>Status: {order.is_billed ? 'Abgerechnet' : 'Offen'}</span>
                <Button 
                  variant={order.is_billed ? 'outline-danger' : 'outline-success'}
                  onClick={() => toggleBilledMutation.mutate(order.id)}
                  disabled={toggleBilledMutation.isPending}
                >
                  {toggleBilledMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : (order.is_billed ? <XCircle className="me-2 h-4 w-4" /> : <CheckCircle2 className="me-2 h-4 w-4" />)}
                  {order.is_billed ? 'Als nicht abgerechnet markieren' : 'Als abgerechnet markieren'}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default BillingDetail;