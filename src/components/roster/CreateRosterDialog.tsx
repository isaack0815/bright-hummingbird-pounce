import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkGroup } from "@/types/workgroup";

const formSchema = z.object({
  work_group_id: z.coerce.number().min(1, "Eine Arbeitsgruppe muss ausgewählt werden."),
  start_date: z.string().min(1, "Startdatum ist erforderlich."),
  end_date: z.string().min(1, "Enddatum ist erforderlich."),
}).refine(data => new Date(data.start_date) <= new Date(data.end_date), {
  message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
  path: ["end_date"],
});

type CreateRosterDialogProps = {
  show: boolean;
  onHide: () => void;
};

const fetchWorkGroups = async (): Promise<WorkGroup[]> => {
  const { data, error } = await supabase
    .from('work_groups')
    .select(`
      id,
      name,
      description,
      user_work_groups (
        profiles (
          id,
          first_name,
          last_name
        )
      )
    `)
    .order('name');

  if (error) throw new Error(error.message);

  const groupsWithMembers = data.map(group => {
    const members = group.user_work_groups.map((m: any) => m.profiles).filter(Boolean);
    const { user_work_groups, ...restOfGroup } = group;
    return { ...restOfGroup, members };
  });

  return groupsWithMembers;
};

export function CreateRosterDialog({ show, onHide }: CreateRosterDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { data: workGroups, isLoading } = useQuery({
    queryKey: ['workGroups'],
    queryFn: fetchWorkGroups,
    enabled: show,
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('manage-rosters', {
        body: { action: 'create', ...values },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Dienstplan erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['workGroupsWithRosters'] });
      onHide();
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen."),
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Neuen Dienstplan erstellen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Arbeitsgruppe</Form.Label>
            <Form.Select {...form.register("work_group_id")} isInvalid={!!form.formState.errors.work_group_id} disabled={isLoading}>
              <option value="">Bitte auswählen...</option>
              {workGroups?.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </Form.Select>
          </Form.Group>
          <div className="row">
            <div className="col"><Form.Group className="mb-3"><Form.Label>Startdatum</Form.Label><Form.Control type="date" {...form.register("start_date")} isInvalid={!!form.formState.errors.start_date} /></Form.Group></div>
            <div className="col"><Form.Group className="mb-3"><Form.Label>Enddatum</Form.Label><Form.Control type="date" {...form.register("end_date")} isInvalid={!!form.formState.errors.end_date} /></Form.Group></div>
          </div>
          {form.formState.errors.end_date && <p className="text-danger small">{form.formState.errors.end_date.message}</p>}
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