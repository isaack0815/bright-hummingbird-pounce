import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useError } from "@/contexts/ErrorContext";

type Permission = {
  id: number;
  name: string;
  description: string | null;
};

type Role = {
  id: number;
  name: string;
  description: string | null;
  permissions: Permission[];
};

const formSchema = z.object({
  name: z.string().min(1, { message: "Gruppenname ist erforderlich." }),
  description: z.string().optional(),
  permissionIds: z.array(z.coerce.number()).optional(),
});

type EditRoleDialogProps = {
  role: Role | null;
  show: boolean;
  onHide: () => void;
};

const fetchPermissions = async (): Promise<Permission[]> => {
  const { data, error } = await supabase.functions.invoke('get-permissions');
  if (error) throw new Error(error.message);
  return data.permissions;
};

export function EditRoleDialog({ role, show, onHide }: EditRoleDialogProps) {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { data: allPermissions, isLoading: isLoadingPermissions } = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    enabled: show,
  });

  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description || "",
        permissionIds: role.permissions.map(p => p.id),
      });
    }
  }, [role, form, show]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!role) return;
      const { error } = await supabase.functions.invoke('update-role', {
        body: {
          roleId: role.id,
          name: values.name,
          description: values.description,
          permissionIds: values.permissionIds || [],
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Gruppe erfolgreich aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['userPermissions'] });
      onHide();
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.message || "Fehler beim Aktualisieren.");
    },
  });

  if (!role) return null;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Gruppe bearbeiten</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}>
        <Modal.Body>
          <p className="text-muted mb-4">
            Ändern Sie die Details und weisen Sie Berechtigungen zu.
          </p>
          <Form.Group className="mb-3" controlId="editRoleName">
            <Form.Label>Gruppenname</Form.Label>
            <Form.Control type="text" {...form.register("name")} isInvalid={!!form.formState.errors.name} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="editRoleDescription">
            <Form.Label>Beschreibung</Form.Label>
            <Form.Control as="textarea" rows={3} {...form.register("description")} isInvalid={!!form.formState.errors.description} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.description?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group>
            <Form.Label>Berechtigungen</Form.Label>
            {isLoadingPermissions ? (
              <p>Berechtigungen werden geladen...</p>
            ) : (
              <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {allPermissions?.map((permission) => (
                  <Form.Check 
                    key={permission.id}
                    type="checkbox"
                    id={`perm-${permission.id}`}
                    label={permission.description || permission.name}
                    {...form.register("permissionIds")}
                    value={permission.id}
                  />
                ))}
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={updateMutation.isPending || isLoadingPermissions}>
            {updateMutation.isPending ? <Spinner as="span" animation="border" size="sm" /> : "Änderungen speichern"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}