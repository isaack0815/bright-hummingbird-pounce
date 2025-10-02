import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import type { Vehicle } from '@/types/vehicle';

const formSchema = z.object({
  kilometers: z.coerce.number().min(0, "Kilometerstand muss positiv sein.").optional(),
  notes: z.string().optional(),
});

type ClockInOutModalProps = {
  show: boolean;
  onHide: () => void;
  type: 'in' | 'out';
  vehicle: Vehicle | null;
  onSubmit: (payload: { kilometers?: number; notes?: string }) => void;
  isMutating: boolean;
};

export function ClockInOutModal({ show, onHide, type, vehicle, onSubmit, isMutating }: ClockInOutModalProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit({ kilometers: values.kilometers, notes: values.notes });
    onHide();
    form.reset();
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{type === 'in' ? 'Arbeitszeit starten' : 'Arbeitszeit beenden'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <Modal.Body>
          {vehicle && (
            <Form.Group className="mb-3">
              <Form.Label>Aktueller Kilometerstand für <strong>{vehicle.license_plate}</strong></Form.Label>
              <Form.Control 
                type="number" 
                {...form.register("kilometers")} 
                isInvalid={!!form.formState.errors.kilometers}
                autoFocus={!!vehicle}
              />
              <Form.Control.Feedback type="invalid">{form.formState.errors.kilometers?.message}</Form.Control.Feedback>
            </Form.Group>
          )}
          {type === 'out' && (
            <Form.Group>
              <Form.Label>Notizen (optional)</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3} 
                {...form.register("notes")} 
                autoFocus={!vehicle}
              />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={isMutating}>
            {isMutating ? <Spinner size="sm" /> : (type === 'in' ? 'Einstempeln' : 'Ausstempeln')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}