import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, ListGroup, Spinner, Button, Alert } from 'react-bootstrap';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Email } from '@/types/email';
import { showError, showSuccess } from '@/utils/toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const fetchEmailsFromDB = async (): Promise<Email[]> => {
  const { data, error } = await supabase.functions.invoke('get-emails');
  if (error) throw error;
  return data.emails;
};

const EmailClient = () => {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const queryClient = useQueryClient();

  const { data: emails, isLoading, error } = useQuery<Email[]>({
    queryKey: ['userEmails'],
    queryFn: fetchEmailsFromDB,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-emails');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      let message = "";
      if (data.newEmails > 0) {
        message = `${data.newEmails} neue E-Mail(s) synchronisiert!`;
        if (data.moreEmailsExist) {
          message += " Es sind weitere E-Mails vorhanden. Bitte erneut aktualisieren.";
        }
        queryClient.invalidateQueries({ queryKey: ['userEmails'] });
      } else {
        message = "Posteingang ist auf dem neuesten Stand.";
      }
      showSuccess(message);
    },
    onError: (err: any) => {
      showError(err.message || "Fehler bei der Synchronisierung.");
    },
  });

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">E-Mail-Posteingang</h1>
        <Button variant="outline-secondary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
          <span className="ms-2">{syncMutation.isPending ? 'Synchronisiere...' : 'Aktualisieren'}</span>
        </Button>
      </div>

      {error && (
        <Alert variant="danger">
          <Alert.Heading>Fehler beim Laden der E-Mails</Alert.Heading>
          <p>{error.message}</p>
        </Alert>
      )}

      <Row>
        <Col md={4}>
          <Card>
            <Card.Header>Posteingang</Card.Header>
            <ListGroup variant="flush" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {isLoading && <div className="text-center p-4"><Spinner size="sm" /></div>}
              {!isLoading && emails?.length === 0 && (
                <div className="text-center p-4 text-muted">
                  Keine E-Mails gefunden.
                </div>
              )}
              {emails?.map(email => (
                <ListGroup.Item key={email.uid} action active={selectedEmail?.uid === email.uid} onClick={() => setSelectedEmail(email)}>
                  <p className="fw-bold mb-0 text-truncate">{email.from_address}</p>
                  <p className="mb-1 text-truncate">{email.subject}</p>
                  <p className="small text-muted mb-0">{format(new Date(email.sent_at), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </Col>
        <Col md={8}>
          <Card style={{ height: '80vh' }}>
            <Card.Body className="d-flex flex-column">
              {selectedEmail ? (
                <>
                  <div className="pb-3 border-bottom">
                    <h5 className="mb-1">{selectedEmail.subject}</h5>
                    <p className="mb-0"><strong>Von:</strong> {selectedEmail.from_address}</p>
                    <p className="text-muted small"><strong>Datum:</strong> {format(new Date(selectedEmail.sent_at), 'eeee, d. MMMM yyyy HH:mm', { locale: de })}</p>
                  </div>
                  <div className="flex-grow-1 mt-3" style={{ overflowY: 'auto' }}>
                    {selectedEmail.body_html ? (
                      <iframe srcDoc={selectedEmail.body_html} style={{ width: '100%', height: '100%', border: 'none' }} title="Email Content" />
                    ) : (
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{selectedEmail.body_text}</pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                  <p>Wählen Sie eine E-Mail aus, um sie anzuzeigen.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default EmailClient;