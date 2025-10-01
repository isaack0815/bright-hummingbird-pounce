import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { VehicleGroup } from "@/types/vehicle";

const formSchema = z.object({
  name: z.string().min(1, { message: "Gruppenname ist erforderlich." }),
  description: z.string().optional(),
});

type EditVehicleGroupDialogProps = {
  group: VehicleGroup | null;
  show: boolean;
  onHide: () => void;
};

export function EditVehicleGroupDialog({ group, show, onHide }: EditVehicleGroupDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (group) {
      form.reset({
        name: group.name,
        description: group.description || "",
      });
    }
  }, [group, form, show]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!group) return;
      const { error } = await supabase.functions.invoke('update-vehicle-group', {
        body: { id: group.id, ...values },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Gruppe aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['vehicleGroups'] });
      onHide();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren."),
  });

  if (!group) return null;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Fahrzeuggruppe bearbeiten</Modal.Title>
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
            {mutation.isPending ? <Spinner as="span" size="sm" /> : "Speichern"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}