import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner, Alert } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  email_address: z.string().email("Ungültige E-Mail-Adresse."),
  imap_username: z.string().min(1, "Benutzername ist erforderlich."),
  imap_password: z.string().min(1, "Passwort ist erforderlich."),
});

type EmailSettingsDialogProps = {
  show: boolean;
  onHide: () => void;
};

export function EmailSettingsDialog({ show, onHide }: EmailSettingsDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('save-email-account', {
        body: values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Kontodaten gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      onHide();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern."),
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>E-Mail-Konto konfigurieren</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Modal.Body>
          <Alert variant="warning">
            Ihre Zugangsdaten werden verschlüsselt gespeichert. Die Serverdaten (Host, Port) werden aus den globalen Einstellungen übernommen.
          </Alert>
          <Form.Group className="mb-3">
            <Form.Label>E-Mail-Adresse</Form.Label>
            <Form.Control {...form.register("email_address")} isInvalid={!!form.formState.errors.email_address} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>IMAP Benutzername</Form.Label>
            <Form.Control {...form.register("imap_username")} isInvalid={!!form.formState.errors.imap_username} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>IMAP Passwort</Form.Label>
            <Form.Control type="password" {...form.register("imap_password")} isInvalid={!!form.formState.errors.imap_password} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner as="span" size="sm" /> : "Speichern"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}