import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, { message: "Tourname ist erforderlich." }),
  description: z.string().optional(),
});

type AddTourDialogProps = {
  show: boolean;
  onHide: () => void;
  onTourCreated: (tourId: number) => void;
};

export function AddTourDialog({ show, onHide, onTourCreated }: AddTourDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "" },
  });

  const createTourMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>): Promise<{ tourId: number }> => {
      const { data, error } = await supabase.functions.invoke('update-tour', {
        body: {
          name: values.name,
          description: values.description,
          stops: [], // Create with no stops initially
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess("Tour erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      onTourCreated(data.tourId);
      onHide();
      form.reset();
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Erstellen der Tour.");
    },
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neue Tour erstellen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => createTourMutation.mutate(v))}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Tourname</Form.Label>
            <Form.Control {...form.register("name")} isInvalid={!!form.formState.errors.name} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Beschreibung</Form.Label>
            <Form.Control as="textarea" rows={3} {...form.register("description")} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={createTourMutation.isPending}>
            {createTourMutation.isPending ? <Spinner as="span" size="sm" /> : "Erstellen & Bearbeiten"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}