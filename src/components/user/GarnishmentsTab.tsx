import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Placeholder, Accordion, Table, Badge, Row, Col } from 'react-bootstrap';
import { PlusCircle, CreditCard } from 'lucide-react';
import { AddGarnishmentDialog } from './AddGarnishmentDialog';
import { AddGarnishmentPaymentDialog } from './AddGarnishmentPaymentDialog';
import type { Garnishment } from '@/types/personnel';

const fetchGarnishments = async (userId: string): Promise<Garnishment[]> => {
  const { data, error } = await supabase.functions.invoke('get-garnishments-for-user', {
    body: { userId },
  });
  if (error) throw error;
  return data.garnishments;
};

export const GarnishmentsTab = ({ userId }: { userId: string }) => {
  const [isAddGarnishmentOpen, setIsAddGarnishmentOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [selectedGarnishment, setSelectedGarnishment] = useState<Garnishment | null>(null);

  const { data: garnishments, isLoading } = useQuery({
    queryKey: ['garnishments', userId],
    queryFn: () => fetchGarnishments(userId),
  });

  const handleAddPaymentClick = (garnishment: Garnishment) => {
    setSelectedGarnishment(garnishment);
    setIsAddPaymentOpen(true);
  };

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <Button onClick={() => setIsAddGarnishmentOpen(true)}>
          <PlusCircle size={16} className="me-2" />
          Neue Pfändung anlegen
        </Button>
      </div>

      {isLoading && <Placeholder as="div" animation="glow"><Placeholder xs={12} style={{ height: '200px' }} /></Placeholder>}
      
      {!isLoading && garnishments?.length === 0 && (
        <Card body className="text-center text-muted">Keine Pfändungen für diesen Nutzer vorhanden.</Card>
      )}

      <Accordion>
        {garnishments?.map((garnishment, index) => (
          <Accordion.Item eventKey={String(index)} key={garnishment.id}>
            <Accordion.Header>
              <div className="d-flex w-100 justify-content-between align-items-center pe-3">
                <div className="flex-grow-1">
                  <strong>{garnishment.creditor}</strong>
                  <small className="text-muted d-block">{garnishment.description || 'Keine Beschreibung'}</small>
                </div>
                <div className="text-end mx-4">
                    <small className="d-block">Offen: <strong>{(Number(garnishment.remaining_amount) || 0).toFixed(2)} €</strong></small>
                    <small className="text-muted d-block">Gesamt: {(Number(garnishment.total_amount) || 0).toFixed(2)} €</small>
                </div>
                <Badge bg={garnishment.status === 'open' ? 'warning' : 'success'}>{garnishment.status === 'open' ? 'Offen' : 'Abgeschlossen'}</Badge>
              </div>
            </Accordion.Header>
            <Accordion.Body>
              <Row className="mb-3">
                <Col><strong>Gesamtbetrag:</strong> {(Number(garnishment.total_amount) || 0).toFixed(2)} €</Col>
                <Col><strong>Bezahlt:</strong> {(Number(garnishment.paid_amount) || 0).toFixed(2)} €</Col>
                <Col><strong>Restbetrag:</strong> {(Number(garnishment.remaining_amount) || 0).toFixed(2)} €</Col>
              </Row>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6>Zahlungshistorie</h6>
                <Button size="sm" variant="outline-primary" onClick={() => handleAddPaymentClick(garnishment)}>
                  <CreditCard size={14} className="me-2" /> Zahlung buchen
                </Button>
              </div>
              <Table striped bordered hover size="sm">
                <thead><tr><th>Datum</th><th>Betrag</th><th>Notizen</th></tr></thead>
                <tbody>
                  {garnishment.payments.map(payment => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.payment_date).toLocaleDateString('de-DE')}</td>
                      <td>{(Number(payment.amount) || 0).toFixed(2)} €</td>
                      <td>{payment.notes}</td>
                    </tr>
                  ))}
                  {garnishment.payments.length === 0 && (
                    <tr><td colSpan={3} className="text-center text-muted">Keine Zahlungen gebucht.</td></tr>
                  )}
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>

      <AddGarnishmentDialog userId={userId} show={isAddGarnishmentOpen} onHide={() => setIsAddGarnishmentOpen(false)} />
      <AddGarnishmentPaymentDialog garnishment={selectedGarnishment} show={isAddPaymentOpen} onHide={() => setIsAddPaymentOpen(false)} />
    </>
  );
};