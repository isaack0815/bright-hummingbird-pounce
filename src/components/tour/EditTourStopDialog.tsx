import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, Modal, Form, Row, Col } from 'react-bootstrap';
import type { RoutePoint } from '@/types/tour';

const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const formSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich."),
  address: z.string().min(1, "Adresse ist erforderlich."),
  weekdays: z.array(z.coerce.number()).default([]),
  arrival_time: z.string().nullable(),
  remarks: z.string().nullable(),
});

type EditTourStopDialogProps = {
  stop: RoutePoint | null;
  show: boolean;
  onHide: () => void;
  onSave: (updatedStop: RoutePoint) => void;
};

export function EditTourStopDialog({ stop, show, onHide, onSave }: EditTourStopDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (stop) {
      form.reset({
        name: stop.name,
        address: stop.address,
        weekdays: stop.weekdays || [],
        arrival_time: stop.arrival_time || null,
        remarks: stop.remarks || null,
      });
    }
  }, [stop, form, show]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!stop) return;
    onSave({
      ...stop,
      name: values.name,
      address: values.address,
      weekdays: values.weekdays,
      arrival_time: values.arrival_time,
      remarks: values.remarks,
    });
    onHide();
  };

  if (!stop) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Stopp bearbeiten: {stop.name}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit(onSubmit)}>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Name des Stopps</Form.Label>
                <Form.Control {...form.register("name")} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Adresse</Form.Label>
                <Form.Control {...form.register("address")} />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Wochentage</Form.Label>
                <div className="d-flex flex-wrap gap-3">
                  {weekdays.map((day, index) => (
                    <Form.Check 
                      key={index}
                      type="checkbox"
                      id={`weekday-${index}`}
                      label={day}
                      value={index}
                      {...form.register("weekdays")}
                    />
                  ))}
                </div>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Ankunftszeit</Form.Label>
                <Form.Control type="time" {...form.register("arrival_time")} />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Bemerkungen</Form.Label>
                <Form.Control as="textarea" rows={3} {...form.register("remarks")} />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit">Änderungen speichern</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}