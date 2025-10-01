import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, { message: "Gruppenname ist erforderlich." }),
  description: z.string().optional(),
});

type AddVehicleGroupDialogProps = {
  show: boolean;
  onHide: () => void;
};

export function AddVehicleGroupDialog({ show, onHide }: AddVehicleGroupDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('create-vehicle-group', {
        body: values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Gruppe erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['vehicleGroups'] });
      onHide();
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen."),
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neue Fahrzeuggruppe</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control {...form.register("name")} isInvalid={!!form.formState.errors.name} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group>
            <Form.Label>Beschreibung</Form.Label>
            <Form.Control as="textarea" {...form.register("description")} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner as="span" size="sm" /> : "Erstellen"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}