import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Modal, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import type { MenuItem } from "@/types/menu";

const formSchema = z.object({
  name: z.string().min(1, { message: "Name ist erforderlich." }),
  link: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.coerce.number().nullable(),
});

type EditMenuItemDialogProps = {
  item: MenuItem | null;
  show: boolean;
  onHide: () => void;
};

const fetchAllMenuItems = async (): Promise<MenuItem[]> => {
  const { data, error } = await supabase.functions.invoke('get-menu-items');
  if (error) throw new Error(error.message);
  return data.items;
};

export function EditMenuItemDialog({ item, show, onHide }: EditMenuItemDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { data: allItems } = useQuery<MenuItem[]>({
    queryKey: ['menuItems'],
    queryFn: fetchAllMenuItems,
    enabled: show,
  });

  const getDescendantIds = (itemId: number, items: MenuItem[]): number[] => {
    const children = items.filter(i => i.parent_id === itemId);
    let descendantIds: number[] = children.map(c => c.id);
    children.forEach(child => {
      descendantIds = [...descendantIds, ...getDescendantIds(child.id, items)];
    });
    return descendantIds;
  };

  const possibleParents = useMemo(() => {
    if (!allItems || !item) return [];
    const descendantIds = getDescendantIds(item.id, allItems);
    const invalidIds = [item.id, ...descendantIds];
    return allItems.filter(i => !invalidIds.includes(i.id));
  }, [allItems, item]);

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        link: item.link || "",
        icon: item.icon || "",
        parentId: item.parent_id,
      });
    }
  }, [item, form, show]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!item) return;
      const { error } = await supabase.functions.invoke('update-menu-item', {
        body: { 
          id: item.id, 
          name: values.name,
          link: values.link,
          icon: values.icon,
          parentId: values.parentId 
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Menüpunkt aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      onHide();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren."),
  });

  if (!item) return null;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Menüpunkt bearbeiten</Modal.Title>
      </Modal.Header>
      <Form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}>
        <Modal.Body>
          <p className="text-muted">Ändern Sie die Details des Menüpunkts.</p>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control {...form.register("name")} isInvalid={!!form.formState.errors.name} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.name?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Link</Form.Label>
            <Form.Control {...form.register("link")} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Icon Name (optional)</Form.Label>
            <Form.Control {...form.register("icon")} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Übergeordnetes Element</Form.Label>
            <Form.Select {...form.register("parentId")} value={String(form.watch("parentId") ?? 'null')}>
              <option value={'null'}>- Kein übergeordnetes Element -</option>
              {possibleParents.map(parent => (
                <option key={parent.id} value={String(parent.id)}>
                  {parent.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Spinner as="span" size="sm" /> : "Speichern"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}