import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner, Row, Col } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useError } from "@/contexts/ErrorContext";
import type { Customer } from "@/pages/CustomerManagement";

const formSchema = z.object({
  company_name: z.string().min(1, "Firmenname ist erforderlich."),
  contact_first_name: z.string().optional(),
  contact_last_name: z.string().optional(),
  email: z.string().email({ message: "Ungültige E-Mail." }).optional().or(z.literal('')),
  street: z.string().optional(),
  house_number: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  tax_number: z.string().optional(),
});

type EditCustomerDialogProps = {
  customer: Customer | null;
  show: boolean;
  onHide: () => void;
};

export function EditCustomerDialog({ customer, show, onHide }: EditCustomerDialogProps) {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        company_name: customer.company_name || "",
        contact_first_name: customer.contact_first_name || "",
        contact_last_name: customer.contact_last_name || "",
        email: customer.email || "",
        street: customer.street || "",
        house_number: customer.house_number || "",
        postal_code: customer.postal_code || "",
        city: customer.city || "",
        country: customer.country || "",
        tax_number: customer.tax_number || "",
      });
    }
  }, [customer, form, show]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!customer) return;
      const { error } = await supabase.functions.invoke('update-customer', {
        body: { id: customer.id, ...values },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Kunde erfolgreich aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onHide();
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || "Fehler beim Aktualisieren des Kunden.");
    },
  });

  if (!customer) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Kunden bearbeiten</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <p className="text-muted mb-4">Aktualisieren Sie die Kundendaten.</p>
          <Form.Group className="mb-3">
            <Form.Label>Firma</Form.Label>
            <Form.Control {...form.register("company_name")} isInvalid={!!form.formState.errors.company_name} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.company_name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Row className="mb-3">
            <Form.Group as={Col}>
              <Form.Label>Vorname (Ansprechpartner)</Form.Label>
              <Form.Control {...form.register("contact_first_name")} />
            </Form.Group>
            <Form.Group as={Col}>
              <Form.Label>Nachname (Ansprechpartner)</Form.Label>
              <Form.Control {...form.register("contact_last_name")} />
            </Form.Group>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label>E-Mail</Form.Label>
            <Form.Control type="email" {...form.register("email")} isInvalid={!!form.formState.errors.email} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.email?.message}</Form.Control.Feedback>
          </Form.Group>
          <Row className="mb-3">
            <Form.Group as={Col} xs={8}>
              <Form.Label>Straße</Form.Label>
              <Form.Control {...form.register("street")} />
            </Form.Group>
            <Form.Group as={Col} xs={4}>
              <Form.Label>Hausnr.</Form.Label>
              <Form.Control {...form.register("house_number")} />
            </Form.Group>
          </Row>
          <Row className="mb-3">
            <Form.Group as={Col} xs={4}>
              <Form.Label>PLZ</Form.Label>
              <Form.Control {...form.register("postal_code")} />
            </Form.Group>
            <Form.Group as={Col} xs={8}>
              <Form.Label>Ort</Form.Label>
              <Form.Control {...form.register("city")} />
            </Form.Group>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label>Land</Form.Label>
            <Form.Control {...form.register("country")} />
          </Form.Group>
          <Row>
            <Form.Group as={Col}>
              <Form.Label>Steuernummer</Form.Label>
              <Form.Control {...form.register("tax_number")} />
            </Form.Group>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Spinner as="span" animation="border" size="sm" /> : "Änderungen speichern"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}