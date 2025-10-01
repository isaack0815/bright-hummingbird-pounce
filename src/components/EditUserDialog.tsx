import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Role = {
  id: number;
  name: string;
};

type User = {
  id: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  roles: Role[];
};

const formSchema = z.object({
  firstName: z.string().min(1, { message: "Vorname ist erforderlich." }),
  lastName: z.string().min(1, { message: "Nachname ist erforderlich." }),
  roleIds: z.array(z.number()).optional(),
});

type EditUserDialogProps = {
  user: User | null;
  show: boolean;
  onHide: () => void;
};

const fetchRoles = async (): Promise<Role[]> => {
  const { data, error } = await supabase.functions.invoke('get-roles');
  if (error) throw new Error(error.message);
  return data.roles;
};

export function EditUserDialog({ user, show, onHide }: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: allRoles, isLoading: isLoadingRoles } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    enabled: show,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      roleIds: [],
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        roleIds: user.roles.map(role => role.id),
      });
    }
  }, [user, form, show]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('update-user', {
        body: {
          userId: user.id,
          firstName: values.firstName,
          lastName: values.lastName,
          roleIds: values.roleIds,
        },
      });

      if (error) throw error;

      showSuccess("Benutzer erfolgreich aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onHide();
    } catch (error: any) {
      console.error("Fehler beim Aktualisieren des Benutzers:", error);
      showError(error.data?.error || "Ein Fehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Nutzer bearbeiten</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit(onSubmit)}>
        <Modal.Body>
          <p className="text-muted mb-4">
            Aktualisieren Sie die Benutzerdaten und weisen Sie Gruppen zu.
          </p>
          <Form.Group className="mb-3" controlId="editFirstName">
            <Form.Label>Vorname</Form.Label>
            <Form.Control type="text" placeholder="Max" {...form.register("firstName")} isInvalid={!!form.formState.errors.firstName} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.firstName?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="editLastName">
            <Form.Label>Nachname</Form.Label>
            <Form.Control type="text" placeholder="Mustermann" {...form.register("lastName")} isInvalid={!!form.formState.errors.lastName} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.lastName?.message}</Form.Control.Feedback>
          </Form.Group>
          
          <Form.Group>
            <Form.Label>Gruppen</Form.Label>
            {isLoadingRoles ? (
              <p>Gruppen werden geladen...</p>
            ) : (
              <div className="border rounded p-3" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {allRoles?.map((role) => (
                  <Form.Check 
                    type="checkbox"
                    id={`role-${role.id}`}
                    key={role.id}
                    label={role.name}
                    {...form.register("roleIds")}
                    value={role.id}
                    defaultChecked={user.roles.some(userRole => userRole.id === role.id)}
                  />
                ))}
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={isSubmitting || isLoadingRoles}>
            {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : "Änderungen speichern"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}