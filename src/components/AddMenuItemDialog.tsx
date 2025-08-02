import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, { message: "Name ist erforderlich." }),
  link: z.string().optional(),
  icon: z.string().optional(),
});

type AddMenuItemDialogProps = {
  show: boolean;
  onHide: () => void;
};

export function AddMenuItemDialog({ show, onHide }: AddMenuItemDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", link: "", icon: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('create-menu-item', {
        body: { ...values, position: 999 }, // Add at the end
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Menüpunkt erstellt!");
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      onHide();
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen."),
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neuen Menüpunkt hinzufügen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
        <Modal.Body>
          <p className="text-muted">Geben Sie die Details für den neuen Menüpunkt ein.</p>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control placeholder="z.B. Dashboard" {...form.register("name")} isInvalid={!!form.formState.errors.name} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Link</Form.Label>
            <Form.Control placeholder="/dashboard oder https://..." {...form.register("link")} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Icon Name (optional)</Form.Label>
            <Form.Control placeholder="z.B. Home" {...form.register("icon")} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? <Spinner as="span" size="sm" /> : "Erstellen"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}