import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Select from 'react-select';
import type { ChatUser } from "@/types/chat";
import { format } from 'date-fns';

const formSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich."),
  description: z.string().optional(),
  date: z.string().min(1, "Datum ist erforderlich."),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  attendee_ids: z.array(z.string()).optional(),
});

type AddEventDialogProps = {
  show: boolean;
  onHide: () => void;
  selectedDate: Date | null;
};

const fetchUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

export function AddEventDialog({ show, onHide, selectedDate }: AddEventDialogProps) {
  const queryClient = useQueryClient();
  const { data: users, isLoading: isLoadingUsers } = useQuery<ChatUser[]>({
    queryKey: ['chatUsers'],
    queryFn: fetchUsers,
    enabled: show,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const startDateTime = values.start_time ? `${values.date}T${values.start_time}` : `${values.date}T00:00:00`;
      const endDateTime = values.end_time ? `${values.date}T${values.end_time}` : null;

      const { error } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          title: values.title,
          description: values.description,
          start_time: new Date(startDateTime).toISOString(),
          end_time: endDateTime ? new Date(endDateTime).toISOString() : null,
          attendee_ids: values.attendee_ids || [],
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Termin erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      onHide();
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen des Termins."),
  });

  const userOptions = users?.map(user => ({
    value: user.id,
    label: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
  })) || [];

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neuen Termin erstellen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
        <Modal.Body>
          <Form.Group className="mb-3"><Form.Label>Titel</Form.Label><Form.Control {...form.register("title")} isInvalid={!!form.formState.errors.title} /></Form.Group>
          <Form.Group className="mb-3"><Form.Label>Datum</Form.Label><Form.Control type="date" {...form.register("date")} isInvalid={!!form.formState.errors.date} /></Form.Group>
          <div className="row">
            <div className="col-6"><Form.Group className="mb-3"><Form.Label>Startzeit</Form.Label><Form.Control type="time" {...form.register("start_time")} /></Form.Group></div>
            <div className="col-6"><Form.Group className="mb-3"><Form.Label>Endzeit</Form.Label><Form.Control type="time" {...form.register("end_time")} /></Form.Group></div>
          </div>
          <Form.Group className="mb-3"><Form.Label>Beschreibung</Form.Label><Form.Control as="textarea" rows={3} {...form.register("description")} /></Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Teilnehmer</Form.Label>
            <Controller
              name="attendee_ids"
              control={form.control}
              render={({ field }) => (
                <Select
                  isMulti
                  options={userOptions}
                  isLoading={isLoadingUsers}
                  onChange={(options) => field.onChange(options.map(o => o.value))}
                  placeholder="Benutzer einladen..."
                />
              )}
            />
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