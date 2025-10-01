import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Garnishment } from "@/types/personnel";

const formSchema = z.object({
  payment_date: z.string().min(1, "Datum ist erforderlich."),
  amount: z.coerce.number().min(0.01, "Betrag muss größer als 0 sein."),
  notes: z.string().optional(),
});

type AddGarnishmentPaymentDialogProps = {
  garnishment: Garnishment | null;
  show: boolean;
  onHide: () => void;
};

export function AddGarnishmentPaymentDialog({ garnishment, show, onHide }: AddGarnishmentPaymentDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!garnishment) return;
      const { error } = await supabase.functions.invoke('add-garnishment-payment', {
        body: { garnishment_id: garnishment.id, ...values },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Zahlung gebucht!");
      queryClient.invalidateQueries({ queryKey: ['garnishments', garnishment?.user_id] });
      onHide();
      form.reset({ payment_date: new Date().toISOString().split('T')[0] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Buchen."),
  });

  if (!garnishment) return null;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Zahlung buchen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Modal.Body>
          <p>Sie buchen eine Zahlung für die Pfändung von <strong>{garnishment.creditor}</strong>.</p>
          <Form.Group className="mb-3">
            <Form.Label>Datum</Form.Label>
            <Form.Control type="date" {...form.register("payment_date")} isInvalid={!!form.formState.errors.payment_date} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Betrag (€)</Form.Label>
            <Form.Control type="number" step="0.01" {...form.register("amount")} isInvalid={!!form.formState.errors.amount} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Notizen / Buchungsdetails</Form.Label>
            <Form.Control as="textarea" {...form.register("notes")} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner as="span" size="sm" /> : "Buchen"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}