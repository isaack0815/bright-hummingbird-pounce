import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const fetchAllMenuItems = async (): Promise<MenuItem[]> => {
  const { data, error } = await supabase.functions.invoke('get-menu-items');
  if (error) throw new Error(error.message);
  return data.items;
};

export function EditMenuItemDialog({ item, open, onOpenChange }: EditMenuItemDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { data: allItems } = useQuery<MenuItem[]>({
    queryKey: ['menuItems'],
    queryFn: fetchAllMenuItems,
    enabled: open,
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
  }, [item, form, open]);

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
      onOpenChange(false);
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren."),
  });

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Menüpunkt bearbeiten</DialogTitle>
          <DialogDescription>Ändern Sie die Details des Menüpunkts.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="link" render={({ field }) => (
              <FormItem>
                <FormLabel>Link</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="icon" render={({ field }) => (
              <FormItem>
                <FormLabel>Icon Name (optional)</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Übergeordnetes Element</FormLabel>
                  <Select onValueChange={field.onChange} value={String(field.value ?? 'null')}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kein übergeordnetes Element" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={'null'}>- Kein übergeordnetes Element -</SelectItem>
                      {possibleParents.map(parent => (
                        <SelectItem key={parent.id} value={String(parent.id)}>
                          {parent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Wird gespeichert..." : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}