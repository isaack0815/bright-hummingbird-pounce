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
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useError } from "@/contexts/ErrorContext";

const formSchema = z.object({
  name: z.string().min(1, { message: "Gruppenname ist erforderlich." }),
  description: z.string().optional(),
});

type AddRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddRoleDialog({ open, onOpenChange }: AddRoleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { addError } = useError();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('create-role', {
        body: {
          name: values.name,
          description: values.description,
        },
      });

      if (error) throw error;

      showSuccess("Gruppe erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      addError(error, 'API');
      showError(error.data?.error || "Ein Fehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neue Gruppe hinzufügen</DialogTitle>
          <DialogDescription>
            Erstellen Sie eine neue Benutzergruppe mit einem Namen und einer optionalen Beschreibung.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gruppenname</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Redakteure" {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Textarea placeholder="z.B. Kann Blogartikel erstellen und bearbeiten." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Wird erstellt..." : "Gruppe erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}