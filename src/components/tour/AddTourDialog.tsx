import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Vehicle } from "@/types/vehicle";
import type { Setting } from "@/types/settings";

const formSchema = z.object({
  name: z.string().min(1, { message: "Tourname ist erforderlich." }),
  description: z.string().optional(),
  vehicle_id: z.coerce.number().nullable().optional(),
});

type AddTourDialogProps = {
  show: boolean;
  onHide: () => void;
  onTourCreated: (tourId: number) => void;
};

const fetchSettings = async (): Promise<Setting[]> => {
  const { data, error } = await supabase.functions.invoke('get-settings');
  if (error) throw new Error(error.message);
  return data.settings;
};

const fetchVehiclesByGroup = async (groupId: number | null): Promise<Vehicle[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicles-by-group', { body: { groupId } });
  if (error) throw new Error(error.message);
  return data.vehicles;
};

export function AddTourDialog({ show, onHide, onTourCreated }: AddTourDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", vehicle_id: null },
  });

  const { data: settings } = useQuery({ 
    queryKey: ['settings'], 
    queryFn: fetchSettings,
    enabled: show,
  });
  const tourVehicleGroupId = settings?.find(s => s.key === 'tour_planning_vehicle_group_id')?.value;

  const { data: availableVehicles, isLoading: isLoadingVehicles } = useQuery({
    queryKey: ['vehiclesByGroup', tourVehicleGroupId],
    queryFn: () => fetchVehiclesByGroup(tourVehicleGroupId ? Number(tourVehicleGroupId) : null),
    enabled: show && !!settings,
  });

  const createTourMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>): Promise<{ tourId: number }> => {
      const { data, error } = await supabase.functions.invoke('update-tour', {
        body: {
          name: values.name,
          description: values.description,
          vehicle_id: values.vehicle_id,
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
          <Form.Group className="mb-3">
            <Form.Label>Fahrzeug</Form.Label>
            <Form.Select {...form.register("vehicle_id")} disabled={isLoadingVehicles}>
              <option value="">- Kein Fahrzeug -</option>
              {availableVehicles?.map(v => (
                <option key={v.id} value={v.id}>{`${v.license_plate} (${v.brand} ${v.model})`}</option>
              ))}
            </Form.Select>
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