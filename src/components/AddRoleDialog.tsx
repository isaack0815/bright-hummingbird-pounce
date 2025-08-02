import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useError } from "@/contexts/ErrorContext";

const formSchema = z.object({
  name: z.string().min(1, { message: "Gruppenname ist erforderlich." }),
  description: z.string().optional(),
});

type AddRoleDialogProps = {
  show: boolean;
  onHide: () => void;
};

export function AddRoleDialog({ show, onHide }: AddRoleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { addError } = useError();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('create-role', {
        body: {
          name: values.name,
          description: values.description,
        },
      });

      if (error) throw error;

      showSuccess("Gruppe erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onHide();
      form.reset();
    } catch (error: any) {
      addError(error, 'API');
      showError(error.data?.error || "Ein Fehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neue Gruppe hinzufügen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit(onSubmit)}>
        <Modal.Body>
          <p className="text-muted mb-4">
            Erstellen Sie eine neue Benutzergruppe mit einem Namen und einer optionalen Beschreibung.
          </p>
          <Form.Group className="mb-3" controlId="roleName">
            <Form.Label>Gruppenname</Form.Label>
            <Form.Control type="text" placeholder="z.B. Redakteure" {...form.register("name")} isInvalid={!!form.formState.errors.name} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="roleDescription">
            <Form.Label>Beschreibung</Form.Label>
            <Form.Control as="textarea" rows={3} placeholder="z.B. Kann Blogartikel erstellen und bearbeiten." {...form.register("description")} isInvalid={!!form.formState.errors.description} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.description?.message}</Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : "Gruppe erstellen"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}