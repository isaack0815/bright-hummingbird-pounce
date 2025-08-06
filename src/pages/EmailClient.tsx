import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, ListGroup, Spinner, Button, Alert } from 'react-bootstrap';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Email } from '@/types/email';
import { getEmailsFromDB, addEmailsToDB, getLatestEmailUid } from '@/lib/idb';
import { showError } from '@/utils/toast';

const EmailClient = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncEmails = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const latestUid = await getLatestEmailUid();
      const { data, error: invokeError } = await supabase.functions.invoke('fetch-emails', {
        body: { sinceUid: latestUid },
      });

      if (invokeError) throw invokeError;
      if (data.error) throw new Error(data.error);

      const newEmails: Email[] = data.emails;
      if (newEmails.length > 0) {
        await addEmailsToDB(newEmails);
        // Lade alle E-Mails neu aus der DB, um die korrekte Sortierung sicherzustellen
        const allEmails = await getEmailsFromDB();
        setEmails(allEmails);
      }
    } catch (err: any) {
      setError(err.message);
      showError(err.message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialEmails = async () => {
      const cachedEmails = await getEmailsFromDB();
      setEmails(cachedEmails);
      // Start background sync after initial load
      syncEmails();
    };
    loadInitialEmails();
  }, [syncEmails]);

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">E-Mail-Posteingang</h1>
        <Button variant="outline-secondary" onClick={syncEmails} disabled={isSyncing}>
          <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          <span className="ms-2">{isSyncing ? 'Synchronisiere...' : 'Aktualisieren'}</span>
        </Button>
      </div>

      {error && (
        <Alert variant="danger">
          <Alert.Heading>Fehler beim Abrufen der E-Mails</Alert.Heading>
          <p>{error}</p>
          <p>Möglicherweise muss ein Administrator Ihr E-Mail-Konto zuerst in Ihrer Personalakte konfigurieren.</p>
        </Alert>
      )}

      <Row>
        <Col md={4}>
          <Card>
            <Card.Header>Posteingang</Card.Header>
            <ListGroup variant="flush" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {emails.length === 0 && !isSyncing && (
                <div className="text-center p-4 text-muted">
                  Keine E-Mails gefunden.
                </div>
              )}
              {emails.map(email => (
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
  );
};

export default EmailClient;