import { useEffect } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner, Alert } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { VacationRequest } from "@/types/vacation";
import { format, parseISO } from 'date-fns';

const formSchema = z.object({
  start_date: z.string().min(1, "Startdatum ist erforderlich."),
  end_date: z.string().min(1, "Enddatum ist erforderlich."),
  notes: z.string().optional(),
}).refine(data => new Date(data.start_date) <= new Date(data.end_date), {
  message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
  path: ["end_date"],
});

type EditVacationRequestDialogProps = {
  request: VacationRequest | null;
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
};

export function EditVacationRequestDialog({ request, show, onHide, onSuccess }: EditVacationRequestDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (request) {
      form.reset({
        start_date: format(parseISO(request.start_date), 'yyyy-MM-dd'),
        end_date: format(parseISO(request.end_date), 'yyyy-MM-dd'),
        notes: request.notes || '',
      });
    }
  }, [request, form, show]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!request) return;
      const { error } = await supabase.rpc('update_vacation_request', {
        p_request_id: request.id,
        p_start_date: values.start_date,
        p_end_date: values.end_date,
        p_notes: values.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Antrag erfolgreich aktualisiert!");
      onSuccess();
      onHide();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren."),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!request) return;
      const { error } = await supabase.from('vacation_requests').delete().eq('id', request.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Antrag gelöscht!");
      onSuccess();
      onHide();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen."),
  });

  const handleDelete = () => {
    if (window.confirm("Möchten Sie diesen Urlaubsantrag wirklich löschen?")) {
      deleteMutation.mutate();
    }
  };

  if (!request) return null;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Urlaubsantrag bearbeiten</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}>
        <Modal.Body>
          {request.status !== 'pending' && (
            <Alert variant="warning">
              Bei einer Datumsänderung wird der Antrag erneut zur Genehmigung vorgelegt.
            </Alert>
          )}
          <div className="row">
            <div className="col"><Form.Group className="mb-3"><Form.Label>Von</Form.Label><Form.Control type="date" {...form.register("start_date")} /></Form.Group></div>
            <div className="col"><Form.Group className="mb-3"><Form.Label>Bis</Form.Label><Form.Control type="date" {...form.register("end_date")} /></Form.Group></div>
          </div>
          <Form.Group>
            <Form.Label>Notizen</Form.Label>
            <Form.Control as="textarea" {...form.register("notes")} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
            Löschen
          </Button>
          <div>
            <Button variant="secondary" onClick={onHide} className="me-2">Abbrechen</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Spinner as="span" size="sm" /> : "Speichern"}
            </Button>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}