import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkGroup } from "@/types/workgroup";
import type { ChatUser } from "@/types/chat";
import Select from 'react-select';

const formSchema = z.object({
  name: z.string().min(1, { message: "Gruppenname ist erforderlich." }),
  description: z.string().optional(),
  userIds: z.array(z.string()).optional(),
});

type EditWorkGroupDialogProps = {
  group: WorkGroup | null;
  show: boolean;
  onHide: () => void;
};

const fetchUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

export function EditWorkGroupDialog({ group, show, onHide }: EditWorkGroupDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { data: allUsers, isLoading: isLoadingUsers } = useQuery<ChatUser[]>({
    queryKey: ['chatUsers'],
    queryFn: fetchUsers,
    enabled: show,
  });

  useEffect(() => {
    if (group) {
      form.reset({
        name: group.name,
        description: group.description || "",
        userIds: group.members.map(m => m.id),
      });
    }
  }, [group, form, show]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!group) return;
      const { error } = await supabase.functions.invoke('update-work-group', {
        body: { id: group.id, ...values },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Arbeitsgruppe aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['workGroups'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onHide();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren."),
  });

  if (!group) return null;

  const userOptions = allUsers?.map(user => ({
    value: user.id,
    label: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
  })) || [];

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Arbeitsgruppe bearbeiten</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control {...form.register("name")} isInvalid={!!form.formState.errors.name} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Beschreibung</Form.Label>
            <Form.Control as="textarea" {...form.register("description")} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Mitglieder</Form.Label>
            <Controller
              name="userIds"
              control={form.control}
              render={({ field }) => (
                <Select
                  isMulti
                  options={userOptions}
                  isLoading={isLoadingUsers}
                  value={userOptions.filter(option => field.value?.includes(option.value))}
                  onChange={options => field.onChange(options.map(option => option.value))}
                  placeholder="Benutzer auswählen..."
                  noOptionsMessage={() => 'Keine Benutzer gefunden'}
                />
              )}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={mutation.isPending || isLoadingUsers}>
            {mutation.isPending ? <Spinner as="span" size="sm" /> : "Speichern"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}