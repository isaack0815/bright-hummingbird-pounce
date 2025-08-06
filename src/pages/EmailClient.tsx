import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, ListGroup, Spinner, Button, Alert } from 'react-bootstrap';
import { RefreshCw, Paperclip, Download } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Email, EmailAttachment } from '@/types/email';
import { showError, showSuccess } from '@/utils/toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const fetchEmailsFromDB = async (): Promise<Email[]> => {
  const { data, error } = await supabase.functions.invoke('get-emails');
  if (error) throw new Error(error.message);
  // Ensure attachments is always an array
  return data.emails.map((email: Email) => ({ ...email, attachments: email.attachments || [] }));
};

const EmailClient = () => {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [totalSynced, setTotalSynced] = useState(0);
  const queryClient = useQueryClient();

  const { data: emails, isLoading, error: queryError } = useQuery<Email[]>({
    queryKey: ['userEmails'],
    queryFn: fetchEmailsFromDB,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-emails');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      const newTotal = totalSynced + data.newEmails;
      if (data.newEmails > 0) {
        queryClient.invalidateQueries({ queryKey: ['userEmails'] });
      }
      
      if (data.moreEmailsExist) {
        setTotalSynced(newTotal);
        showSuccess(`${newTotal} neue E-Mail(s) synchronisiert. Weitere werden geladen...`);
        syncMutation.mutate(); // Fetch next batch
      } else {
        if (newTotal > 0) {
          showSuccess(`Synchronisierung abgeschlossen. Insgesamt ${newTotal} neue E-Mail(s).`);
        } else {
          showSuccess("Posteingang ist auf dem neuesten Stand.");
        }
        setTotalSynced(0); // Reset after full sync
      }
    },
    onError: (err: any) => {
      showError(err.message || "Fehler bei der Synchronisierung.");
      setTotalSynced(0); // Reset on error
    },
  });

  const handleDownloadAttachment = async (attachment: EmailAttachment) => {
    const { data, error } = await supabase.storage
      .from('email-attachments')
      .createSignedUrl(attachment.file_path, 60); // URL valid for 60 seconds

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
        <Button variant="outline-secondary" onClick={() => { setTotalSynced(0); syncMutation.mutate(); }} disabled={syncMutation.isPending}>
          <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
          <span className="ms-2">{syncMutation.isPending ? 'Synchronisiere...' : 'Aktualisieren'}</span>
        </Button>
      </div>

      {queryError && (
        <Alert variant="danger">
          <Alert.Heading>Fehler beim Laden der E-Mails</Alert.Heading>
          <p>{queryError.message}</p>
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
                  <div className="d-flex justify-content-between">
                    <p className="fw-bold mb-0 text-truncate">{email.from_address}</p>
                    {email.attachments && email.attachments.length > 0 && <Paperclip size={14} className="text-muted" />}
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
                    {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                      <div className="mt-2">
                        <strong>Anhänge:</strong>
                        <ul className="list-unstyled mb-0">
                          {selectedEmail.attachments.map(att => (
                            <li key={att.id}>
                              <Button variant="link" size="sm" onClick={() => handleDownloadAttachment(att)} className="p-0">
                                <Download size={14} className="me-1" />
                                {att.file_name}
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