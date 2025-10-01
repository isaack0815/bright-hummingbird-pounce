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

type AddCustomerDialogProps = {
  show: boolean;
  onHide: () => void;
  onCustomerCreated?: (customer: Customer) => void;
};

export function AddCustomerDialog({ show, onHide, onCustomerCreated }: AddCustomerDialogProps) {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: "",
      contact_first_name: "",
      contact_last_name: "",
      email: "",
      street: "",
      house_number: "",
      postal_code: "",
      city: "",
      country: "",
      tax_number: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>): Promise<Customer> => {
      const { data, error } = await supabase.functions.invoke('manage-customers', {
        body: { action: 'create', payload: values },
      });
      if (error) throw error;
      return data.customer;
    },
    onSuccess: (newCustomer) => {
      showSuccess("Kunde erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (onCustomerCreated) {
        onCustomerCreated(newCustomer);
      } else {
        onHide();
      }
      form.reset();
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || "Fehler beim Erstellen des Kunden.");
    },
  });

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Neuen Kunden anlegen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <p className="text-muted mb-4">Füllen Sie die Details aus, um einen neuen Kunden zu erstellen.</p>
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
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? <Spinner as="span" animation="border" size="sm" /> : "Kunde erstellen"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}