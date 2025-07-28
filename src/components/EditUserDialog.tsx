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
import { Checkbox } from "@/components/ui/checkbox";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const fetchRoles = async (): Promise<Role[]> => {
  const { data, error } = await supabase.functions.invoke('get-roles');
  if (error) throw new Error(error.message);
  return data.roles;
};

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: allRoles, isLoading: isLoadingRoles } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    enabled: open,
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
  }, [user, form]);

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
      onOpenChange(false);
    } catch (error: any) {
      console.error("Fehler beim Aktualisieren des Benutzers:", error);
      showError(error.data?.error || "Ein Fehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nutzer bearbeiten</DialogTitle>
          <DialogDescription>
            Aktualisieren Sie die Benutzerdaten und weisen Sie Gruppen zu.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vorname</FormLabel>
                  <FormControl>
                    <Input placeholder="Max" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nachname</FormLabel>
                  <FormControl>
                    <Input placeholder="Mustermann" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-2">
              <FormLabel>Gruppen</FormLabel>
              {isLoadingRoles ? (
                <p>Gruppen werden geladen...</p>
              ) : (
                <FormField
                  control={form.control}
                  name="roleIds"
                  render={() => (
                    <FormItem>
                      {allRoles?.map((role) => (
                        <FormField
                          key={role.id}
                          control={form.control}
                          name="roleIds"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={role.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(role.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), role.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== role.id
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {role.name}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || isLoadingRoles}>
                {isSubmitting ? "Wird gespeichert..." : "Änderungen speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}