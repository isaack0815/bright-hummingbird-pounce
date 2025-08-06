import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, ListGroup, Spinner, Button, Alert } from 'react-bootstrap';
import { RefreshCw, Paperclip, Download } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Email, EmailAttachment } from '@/types/email';
import { showError } from '@/utils/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const fetchEmailsFromDB = async (): Promise<Email[]> => {
  const { data, error } = await supabase.functions.invoke('get-emails');
  if (error) throw new Error(error.message);
  // Sort emails by date, newest first
  const sortedEmails = data.emails.sort((a: Email, b: Email) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
  return sortedEmails.map((email: Email) => ({ ...email, attachments: email.attachments || [] }));
};

const EmailClient = () => {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const queryClient = useQueryClient();

  const { data: emails, isLoading, error: queryError, isRefetching } = useQuery<Email[]>({
    queryKey: ['userEmails'],
    queryFn: fetchEmailsFromDB,
  });

  // Automatically select the first email when the list loads
  useEffect(() => {
    if (emails && emails.length > 0 && !selectedEmail) {
      setSelectedEmail(emails[0]);
    }
  }, [emails, selectedEmail]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['userEmails'] });
  };

  const handleDownloadAttachment = async (attachment: EmailAttachment) => {
    const { data, error } = await supabase.storage.from('email-attachments').createSignedUrl(attachment.file_path, 60);
    if (error) {
      showError("Fehler beim Erstellen des Download-Links.");
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">E-Mail-Posteingang</h1>
        <Button variant="outline-secondary" onClick={handleRefresh} disabled={isRefetching}>
          <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
          <span className="ms-2">{isRefetching ? 'Lade...' : 'Aktualisieren'}</span>
        </Button>
      </div>

      {queryError && <Alert variant="danger"><Alert.Heading>Fehler beim Laden der E-Mails</Alert.Heading><p>{queryError.message}</p></Alert>}

      <Row>
        <Col md={4}>
          <Card>
            <Card.Header>Posteingang</Card.Header>
            <ListGroup variant="flush" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {isLoading && <div className="text-center p-4"><Spinner size="sm" /></div>}
              {!isLoading && emails?.length === 0 && <div className="text-center p-4 text-muted">Keine E-Mails gefunden.</div>}
              {emails?.map(email => (
                <ListGroup.Item key={email.uid + email.mailbox} action active={selectedEmail?.id === email.id} onClick={() => setSelectedEmail(email)}>
                  <div className="d-flex justify-content-between">
                    <p className="fw-bold mb-0 text-truncate">{email.from_address}</p>
                    {email.attachments?.length > 0 && <Paperclip size={14} className="text-muted" />}
                  </div>
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
                    {selectedEmail.attachments?.length > 0 && (
                      <div className="mt-2">
                        <strong>Anhänge:</strong>
                        <ul className="list-unstyled mb-0">
                          {selectedEmail.attachments.map(att => (
                            <li key={att.id}>
                              <Button variant="link" size="sm" onClick={() => handleDownloadAttachment(att)} className="p-0">
                                <Download size={14} className="me-1" /> {att.file_name}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                <div className="d-flex align-items-center justify-content-center h-100 text-muted"><p>Wählen Sie eine E-Mail aus, um sie anzuzeigen.</p></div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default EmailClient;