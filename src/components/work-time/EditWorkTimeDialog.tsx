import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { format } from 'date-fns';

const formSchema = z.object({
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  break_duration_minutes: z.coerce.number().min(0),
  notes: z.string().optional(),
});

type WorkSession = {
  id: number;
  start_time: string;
  end_time: string | null;
  break_duration_minutes: number;
  notes: string | null;
};

type EditWorkTimeDialogProps = {
  session: WorkSession | null;
  show: boolean;
  onHide: () => void;
  onSave: (id: number, data: any) => void;
};

export function EditWorkTimeDialog({ session, show, onHide, onSave }: EditWorkTimeDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (session) {
      const start = new Date(session.start_time);
      const end = session.end_time ? new Date(session.end_time) : new Date();
      form.reset({
        date: format(start, 'yyyy-MM-dd'),
        start_time: format(start, 'HH:mm'),
        end_time: session.end_time ? format(end, 'HH:mm') : '',
        break_duration_minutes: session.break_duration_minutes,
        notes: session.notes || '',
      });
    }
  }, [session, form, show]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!session) return;
    const startDateTime = new Date(`${values.date}T${values.start_time}`);
    const endDateTime = values.end_time ? new Date(`${values.date}T${values.end_time}`) : null;
    onSave(session.id, {
      start_time: startDateTime.toISOString(),
      end_time: endDateTime?.toISOString(),
      break_duration_minutes: values.break_duration_minutes,
      notes: values.notes,
    });
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Zeiteintrag bearbeiten</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit(onSubmit)}>
        <Modal.Body>
          <Form.Group className="mb-3"><Form.Label>Datum</Form.Label><Form.Control type="date" {...form.register("date")} /></Form.Group>
          <div className="row">
            <div className="col"><Form.Group className="mb-3"><Form.Label>Startzeit</Form.Label><Form.Control type="time" {...form.register("start_time")} /></Form.Group></div>
            <div className="col"><Form.Group className="mb-3"><Form.Label>Endzeit</Form.Label><Form.Control type="time" {...form.register("end_time")} /></Form.Group></div>
          </div>
          <Form.Group className="mb-3"><Form.Label>Pause (Minuten)</Form.Label><Form.Control type="number" {...form.register("break_duration_minutes")} /></Form.Group>
          <Form.Group><Form.Label>Notizen</Form.Label><Form.Control as="textarea" {...form.register("notes")} /></Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit">Speichern</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}