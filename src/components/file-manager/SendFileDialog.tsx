import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import type { OrderFileWithDetails } from '@/types/files';

const formSchema = z.object({
  recipientEmail: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
  subject: z.string().min(1, "Ein Betreff ist erforderlich."),
  messageBody: z.string().optional(),
});

type SendFileDialogProps = {
  file: OrderFileWithDetails | null;
  show: boolean;
  onHide: () => void;
};

const fetchUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('email_signature').eq('id', user.id).single();
  return profile;
};

export const SendFileDialog = ({ file, show, onHide }: SendFileDialogProps) => {
  const { data: userProfile } = useQuery({
    queryKey: ['userProfileSignature'],
    queryFn: fetchUserProfile,
    enabled: show,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!file) return;
      const { data, error } = await supabase.functions.invoke('send-order-file-email', {
        body: {
          fileId: file.id,
          ...values,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message || "E-Mail erfolgreich versendet!");
      onHide();
      form.reset();
    },
    onError: (err: any) => {
      showError(err.data?.error || err.message || "Fehler beim Senden der E-Mail.");
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  if (!file) return null;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Datei per E-Mail senden</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <Modal.Body>
          <p>Sie senden die Datei: <strong>{file.file_name}</strong></p>
          <Form.Group className="mb-3">
            <Form.Label>Empfänger-E-Mail</Form.Label>
            <Form.Control {...form.register("recipientEmail")} isInvalid={!!form.formState.errors.recipientEmail} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.recipientEmail?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Betreff</Form.Label>
            <Form.Control {...form.register("subject")} isInvalid={!!form.formState.errors.subject} defaultValue={`Datei: ${file.file_name}`} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.subject?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group>
            <Form.Label>Nachricht (optional)</Form.Label>
            <Form.Control as="textarea" rows={4} {...form.register("messageBody")} placeholder="Ihre Nachricht hier..." />
          </Form.Group>
          {userProfile?.email_signature && (
            <div className="mt-3 p-3 border rounded bg-light">
              <p className="small text-muted mb-2">Ihre Signatur wird angehängt:</p>
              <div className="small" dangerouslySetInnerHTML={{ __html: userProfile.email_signature }} />
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner size="sm" /> : 'Senden'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};