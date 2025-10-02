import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner, Row, Col } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkGroup } from "@/types/workgroup";

type Role = {
  id: number;
  name: string;
};

type User = {
  id: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  roles: Role[];
  work_groups: { id: number; name: string }[];
};

const formSchema = z.object({
  firstName: z.string().min(1, { message: "Vorname ist erforderlich." }),
  lastName: z.string().min(1, { message: "Nachname ist erforderlich." }),
  username: z.string().min(3, { message: "Benutzername muss mindestens 3 Zeichen lang sein." }).regex(/^[a-zA-Z0-9_]+$/, { message: "Nur Buchstaben, Zahlen und Unterstriche erlaubt." }),
  roleIds: z.array(z.coerce.number()).optional(),
  workGroupIds: z.array(z.coerce.number()).optional(),
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

const fetchWorkGroups = async (): Promise<WorkGroup[]> => {
  const { data: groupsData, error: groupsError } = await supabase
    .from('work_groups')
    .select(`id, name, description, user_work_groups(user_id)`)
    .order('name');

  if (groupsError) throw new Error(groupsError.message);
  if (!groupsData) return [];

  const allUserIds = [...new Set(groupsData.flatMap(g => g.user_work_groups.map((m: any) => m.user_id)))];

  if (allUserIds.length === 0) {
    return groupsData.map(group => {
      const { user_work_groups, ...restOfGroup } = group;
      return { ...restOfGroup, members: [] };
    });
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', allUserIds);

  if (profilesError) throw new Error(profilesError.message);
  if (!profiles) return [];

  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  const groupsWithMembers = groupsData.map(group => {
    const members = group.user_work_groups.map((m: any) => profilesMap.get(m.user_id)).filter(Boolean);
    const { user_work_groups, ...restOfGroup } = group;
    return { ...restOfGroup, members };
  });

  return groupsWithMembers;
};

export function EditUserDialog({ user, show, onHide }: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: allRoles, isLoading: isLoadingRoles } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    enabled: show,
  });

  const { data: allWorkGroups, isLoading: isLoadingWorkGroups } = useQuery<WorkGroup[]>({
    queryKey: ['workGroups'],
    queryFn: fetchWorkGroups,
    enabled: show,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        username: user.username || "",
        roleIds: user.roles.map(role => role.id),
        workGroupIds: user.work_groups.map(group => group.id),
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
          ...values
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
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Nutzer bearbeiten</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit(onSubmit)}>
        <Modal.Body>
          <Row className="g-3 pt-3">
            <Col md={6}><Form.Group><Form.Label>Vorname</Form.Label><Form.Control {...form.register("firstName")} isInvalid={!!form.formState.errors.firstName} /></Form.Group></Col>
            <Col md={6}><Form.Group><Form.Label>Nachname</Form.Label><Form.Control {...form.register("lastName")} isInvalid={!!form.formState.errors.lastName} /></Form.Group></Col>
            <Col md={6}><Form.Group><Form.Label>Benutzername</Form.Label><Form.Control {...form.register("username")} isInvalid={!!form.formState.errors.username} /></Form.Group></Col>
            <Col md={6}><Form.Group><Form.Label>Email</Form.Label><Form.Control type="email" value={user.email} disabled /></Form.Group></Col>
          </Row>
          <hr />
          <Row>
            <Col md={6}>
              <h5 className="h6">Berechtigungsgruppen</h5>
              {isLoadingRoles ? <p>Gruppen werden geladen...</p> : (
                <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {allRoles?.map((role) => (
                    <Form.Check type="checkbox" id={`role-${role.id}`} key={role.id} label={role.name} {...form.register("roleIds")} value={role.id} defaultChecked={user.roles.some(userRole => userRole.id === role.id)} />
                  ))}
                </div>
              )}
            </Col>
            <Col md={6}>
              <h5 className="h6">Arbeitsgruppen</h5>
              {isLoadingWorkGroups ? <p>Arbeitsgruppen werden geladen...</p> : (
                <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {allWorkGroups?.map((group) => (
                    <Form.Check type="checkbox" id={`work-group-${group.id}`} key={group.id} label={group.name} {...form.register("workGroupIds")} value={group.id} defaultChecked={user.work_groups.some(userGroup => userGroup.id === group.id)} />
                  ))}
                </div>
              )}
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={isSubmitting || isLoadingRoles || isLoadingWorkGroups}>
            {isSubmitting ? <Spinner as="span" size="sm" /> : "Änderungen speichern"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}