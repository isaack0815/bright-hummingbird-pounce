import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useState } from "react";

const formSchema = z.object({
  firstName: z.string().min(1, { message: "Vorname ist erforderlich." }),
  lastName: z.string().min(1, { message: "Nachname ist erforderlich." }),
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
  password: z.string().min(6, { message: "Passwort muss mindestens 6 Zeichen lang sein." }),
});

type AddUserDialogProps = {
  show: boolean;
  onHide: () => void;
  onUserAdded: () => void;
};

export function AddUserDialog({ show, onHide, onUserAdded }: AddUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('create-user', {
        body: {
          first_name: values.firstName,
          last_name: values.lastName,
          email: values.email,
          password: values.password,
        },
      });

      if (error) throw error;

      showSuccess("Benutzer erfolgreich erstellt!");
      onUserAdded();
      onHide();
      form.reset();
    } catch (error: any) {
      console.error("Fehler beim Erstellen des Benutzers:", error);
      showError(error.data?.error || "Ein Fehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neuen Nutzer hinzufügen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit(onSubmit)}>
        <Modal.Body>
          <p className="text-muted mb-4">
            Füllen Sie die Details aus, um einen neuen Benutzer zu erstellen.
          </p>
          <Form.Group className="mb-3" controlId="firstName">
            <Form.Label>Vorname</Form.Label>
            <Form.Control type="text" placeholder="Max" {...form.register("firstName")} isInvalid={!!form.formState.errors.firstName} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.firstName?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="lastName">
            <Form.Label>Nachname</Form.Label>
            <Form.Control type="text" placeholder="Mustermann" {...form.register("lastName")} isInvalid={!!form.formState.errors.lastName} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.lastName?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" placeholder="m@example.com" {...form.register("email")} isInvalid={!!form.formState.errors.email} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.email?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="password">
            <Form.Label>Passwort</Form.Label>
            <Form.Control type="password" {...form.register("password")} isInvalid={!!form.formState.errors.password} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.password?.message}</Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : "Nutzer erstellen"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}