import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, { message: "Ordnername ist erforderlich." }),
});

type CreateFolderModalProps = {
  show: boolean;
  onHide: () => void;
  parentFolderId: number | null;
};

export function CreateFolderModal({ show, onHide, parentFolderId }: CreateFolderModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('action', {
        body: { 
          action: 'create-folder',
          payload: { name: values.name, parent_folder_id: parentFolderId }
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Ordner erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['fileStructure'] });
      onHide();
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen."),
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neuer Ordner</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Ordnername</Form.Label>
            <Form.Control {...form.register("name")} isInvalid={!!form.formState.errors.name} autoFocus />
            <Form.Control.Feedback type="invalid">{form.formState.errors.name?.message}</Form.Control.Feedback>
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