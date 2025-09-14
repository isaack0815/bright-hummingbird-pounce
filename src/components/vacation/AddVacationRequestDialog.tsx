import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const formSchema = z.object({
  start_date: z.string().min(1, "Startdatum ist erforderlich."),
  end_date: z.string().min(1, "Enddatum ist erforderlich."),
  notes: z.string().optional(),
}).refine(data => new Date(data.start_date) <= new Date(data.end_date), {
  message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
  path: ["end_date"],
});

type AddVacationRequestDialogProps = {
  show: boolean;
  onHide: () => void;
  onSuccess?: () => void;
};

export function AddVacationRequestDialog({ show, onHide, onSuccess }: AddVacationRequestDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase.from('vacation_requests').insert({
        ...values,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Antrag erfolgreich eingereicht!");
      if (onSuccess) {
        onSuccess();
      } else {
        queryClient.invalidateQueries({ queryKey: ['vacationRequests'] });
      }
      onHide();
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Einreichen."),
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neuen Urlaubsantrag stellen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Modal.Body>
          <div className="row">
            <div className="col"><Form.Group className="mb-3"><Form.Label>Von</Form.Label><Form.Control type="date" {...form.register("start_date")} isInvalid={!!form.formState.errors.start_date} /></Form.Group></div>
            <div className="col"><Form.Group className="mb-3"><Form.Label>Bis</Form.Label><Form.Control type="date" {...form.register("end_date")} isInvalid={!!form.formState.errors.end_date} /></Form.Group></div>
          </div>
          {form.formState.errors.end_date && <p className="text-danger small">{form.formState.errors.end_date.message}</p>}
          <Form.Group>
            <Form.Label>Notizen (optional)</Form.Label>
            <Form.Control as="textarea" {...form.register("notes")} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner as="span" size="sm" /> : "Einreichen"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}