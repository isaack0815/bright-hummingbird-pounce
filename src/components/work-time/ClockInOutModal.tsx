import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import type { Vehicle } from '@/types/vehicle';

const formSchema = z.object({
  kilometers: z.coerce.number().min(0, "Kilometerstand muss positiv sein."),
});

type ClockInOutModalProps = {
  show: boolean;
  onHide: () => void;
  type: 'in' | 'out';
  vehicle: Vehicle;
  onSubmit: (kilometers: number) => void;
  isMutating: boolean;
};

export function ClockInOutModal({ show, onHide, type, vehicle, onSubmit, isMutating }: ClockInOutModalProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values.kilometers);
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
          <p>Bitte geben Sie den aktuellen Kilometerstand für das Fahrzeug <strong>{vehicle.license_plate}</strong> ein.</p>
          <Form.Group>
            <Form.Label>Aktueller Kilometerstand</Form.Label>
            <Form.Control 
              type="number" 
              {...form.register("kilometers")} 
              isInvalid={!!form.formState.errors.kilometers}
              autoFocus
            />
            <Form.Control.Feedback type="invalid">{form.formState.errors.kilometers?.message}</Form.Control.Feedback>
          </Form.Group>
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