import { useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useError } from "@/contexts/ErrorContext";
import { ScrollArea } from "./ui/scroll-area";

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
  permissionIds: z.array(z.number()).optional(),
});

type EditRoleDialogProps = {
  role: Role | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const fetchPermissions = async (): Promise<Permission[]> => {
  const { data, error } = await supabase.functions.invoke('get-permissions');
  if (error) throw new Error(error.message);
  return data.permissions;
};

export function EditRoleDialog({ role, open, onOpenChange }: EditRoleDialogProps) {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { data: allPermissions, isLoading: isLoadingPermissions } = useQuery<Permission[]>({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    enabled: open,
  });

  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description || "",
        permissionIds: role.permissions.map(p => p.id),
      });
    }
  }, [role, form, open]);

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
      onOpenChange(false);
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.message || "Fehler beim Aktualisieren.");
    },
  });

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gruppe bearbeiten</DialogTitle>
          <DialogDescription>
            Ändern Sie die Details und weisen Sie Berechtigungen zu.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gruppenname</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-2">
              <FormLabel>Berechtigungen</FormLabel>
              {isLoadingPermissions ? (
                <p>Berechtigungen werden geladen...</p>
              ) : (
                <ScrollArea className="h-40 rounded-md border p-4">
                  <FormField
                    control={form.control}
                    name="permissionIds"
                    render={() => (
                      <FormItem className="space-y-2">
                        {allPermissions?.map((permission) => (
                          <FormField
                            key={permission.id}
                            control={form.control}
                            name="permissionIds"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(permission.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), permission.id])
                                        : field.onChange(field.value?.filter((id) => id !== permission.id));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">{permission.description || permission.name}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </FormItem>
                    )}
                  />
                </ScrollArea>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending || isLoadingPermissions}>
                {updateMutation.isPending ? "Wird gespeichert..." : "Änderungen speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}