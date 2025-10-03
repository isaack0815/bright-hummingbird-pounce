import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { format } from 'date-fns';

const formSchema = z.object({
  start_date: z.string().min(1, "Startdatum ist erforderlich."),
  end_date: z.string().min(1, "Enddatum ist erforderlich."),
}).refine(data => new Date(data.start_date) <= new Date(data.end_date), {
  message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
  path: ["end_date"],
});

type ReportSickDialogProps = {
  show: boolean;
  onHide: () => void;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isMutating: boolean;
};

export function ReportSickDialog({ show, onHide, onSubmit, isMutating }: ReportSickDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Krankmeldung einreichen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit(onSubmit)}>
        <Modal.Body>
          <p className="text-muted">Bitte geben Sie den Zeitraum Ihrer Abwesenheit an.</p>
          <div className="row">
            <div className="col">
              <Form.Group className="mb-3">
                <Form.Label>Von</Form.Label>
                <Form.Control type="date" {...form.register("start_date")} isInvalid={!!form.formState.errors.start_date} />
              </Form.Group>
            </div>
            <div className="col">
              <Form.Group className="mb-3">
                <Form.Label>Bis</Form.Label>
                <Form.Control type="date" {...form.register("end_date")} isInvalid={!!form.formState.errors.end_date} />
              </Form.Group>
            </div>
          </div>
          {form.formState.errors.end_date && <p className="text-danger small">{form.formState.errors.end_date.message}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={isMutating}>
            {isMutating ? <Spinner as="span" size="sm" /> : "Senden"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}