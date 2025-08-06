import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, ListGroup, Spinner, Button, Alert } from 'react-bootstrap';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Email } from '@/types/email';

const fetchEmails = async (): Promise<Email[]> => {
  const { data, error } = await supabase.functions.invoke('fetch-emails');
  if (error) throw new Error(error.message);
  return data.emails.sort((a: Email, b: Email) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const EmailClient = () => {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Initialisiere Verbindung...');

  const { data: emails, isLoading, error, refetch } = useQuery<Email[]>({
    queryKey: ['emails'],
    queryFn: fetchEmails,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isLoading) {
      const messages = [
        "Stelle Verbindung zum IMAP-Server her...",
        "Authentifiziere...",
        "Frage Postfach-Informationen ab...",
        "Lade E-Mail-Liste herunter...",
        "Synchronisiere E-Mails (dies kann einen Moment dauern)..."
      ];
      let messageIndex = 0;
      setLoadingMessage(messages[0]);

      const intervalId = setInterval(() => {
        messageIndex++;
        if (messageIndex < messages.length) {
          setLoadingMessage(messages[messageIndex]);
        } else {
          clearInterval(intervalId); // Am Ende bei der letzten Nachricht bleiben
        }
      }, 2500); // Nachricht alle 2.5 Sekunden wechseln

      return () => clearInterval(intervalId);
    }
  }, [isLoading]);

  return (
    <>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h2">E-Mail-Posteingang</h1>
          <div>
            <Button variant="outline-secondary" onClick={() => refetch()} disabled={isLoading} className="me-2">
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="danger">
            <Alert.Heading>Fehler beim Abrufen der E-Mails</Alert.Heading>
            <p>{error.message}</p>
            <p>Möglicherweise muss ein Administrator Ihr E-Mail-Konto zuerst in Ihrer Personalakte konfigurieren.</p>
          </Alert>
        )}

        <Row>
          <Col md={4}>
            <Card>
              <Card.Header>Posteingang</Card.Header>
              <ListGroup variant="flush" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                {isLoading && (
                  <div className="text-center p-4 text-muted">
                    <Spinner size="sm" className="me-2" />
                    {loadingMessage}
                  </div>
                )}
                {!isLoading && emails?.map(email => (
                  <ListGroup.Item key={email.uid} action active={selectedEmail?.uid === email.uid} onClick={() => setSelectedEmail(email)}>
                    <p className="fw-bold mb-0 text-truncate">{email.from}</p>
                    <p className="mb-1 text-truncate">{email.subject}</p>
                    <p className="small text-muted mb-0">{format(new Date(email.date), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
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
                      <p className="mb-0"><strong>Von:</strong> {selectedEmail.from}</p>
                      <p className="text-muted small"><strong>Datum:</strong> {format(new Date(selectedEmail.date), 'eeee, d. MMMM yyyy HH:mm', { locale: de })}</p>
                    </div>
                    <div className="flex-grow-1 mt-3" style={{ overflowY: 'auto' }}>
                      {selectedEmail.html ? (
                        <iframe srcDoc={selectedEmail.html} style={{ width: '100%', height: '100%', border: 'none' }} title="Email Content" />
                      ) : (
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{selectedEmail.text}</pre>
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
    </>
  );
};

export default EmailClient;