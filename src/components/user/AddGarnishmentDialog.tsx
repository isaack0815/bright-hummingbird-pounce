import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  creditor: z.string().min(1, "Gläubiger ist erforderlich."),
  description: z.string().optional(),
  total_amount: z.coerce.number().min(0.01, "Betrag muss größer als 0 sein."),
});

type AddGarnishmentDialogProps = {
  userId: string;
  show: boolean;
  onHide: () => void;
};

export function AddGarnishmentDialog({ userId, show, onHide }: AddGarnishmentDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('create-garnishment', {
        body: { userId, ...values },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Pfändung erfolgreich angelegt!");
      queryClient.invalidateQueries({ queryKey: ['garnishments', userId] });
      onHide();
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Anlegen."),
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neue Pfändung anlegen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Gläubiger</Form.Label>
            <Form.Control {...form.register("creditor")} isInvalid={!!form.formState.errors.creditor} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Gesamtbetrag (€)</Form.Label>
            <Form.Control type="number" step="0.01" {...form.register("total_amount")} isInvalid={!!form.formState.errors.total_amount} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Beschreibung / Aktenzeichen</Form.Label>
            <Form.Control as="textarea" {...form.register("description")} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner as="span" size="sm" /> : "Anlegen"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}