import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Select from 'react-select';
import type { ChatUser } from "@/types/chat";

const formSchema = z.object({
  subject: z.string().min(1, "Betreff ist erforderlich."),
  description: z.string().optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().uuid("Ein Benutzer muss ausgewählt werden."),
});

type AddTodoDialogProps = {
  show: boolean;
  onHide: () => void;
};

const fetchUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

export function AddTodoDialog({ show, onHide }: AddTodoDialogProps) {
  const queryClient = useQueryClient();
  const { data: users, isLoading: isLoadingUsers } = useQuery<ChatUser[]>({
    queryKey: ['chatUsers'],
    queryFn: fetchUsers,
    enabled: show,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('create-todo', {
        body: values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("ToDo erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['myTodos'] });
      onHide();
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen des ToDos."),
  });

  const userOptions = users?.map(user => ({
    value: user.id,
    label: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
  })) || [];

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neues ToDo erstellen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Betreff</Form.Label>
            <Form.Control {...form.register("subject")} isInvalid={!!form.formState.errors.subject} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.subject?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Beschreibung</Form.Label>
            <Form.Control as="textarea" rows={3} {...form.register("description")} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Fällig bis</Form.Label>
            <Form.Control type="date" {...form.register("due_date")} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Zuweisen an</Form.Label>
            <Controller
              name="assigned_to"
              control={form.control}
              render={({ field }) => (
                <Select
                  options={userOptions}
                  isLoading={isLoadingUsers}
                  onChange={(option) => field.onChange(option?.value)}
                  value={userOptions.find(c => c.value === field.value)}
                  placeholder="Benutzer auswählen..."
                />
              )}
            />
            {form.formState.errors.assigned_to && <div className="text-danger small mt-1">{form.formState.errors.assigned_to.message}</div>}
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