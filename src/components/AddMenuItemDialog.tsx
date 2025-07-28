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
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, { message: "Name ist erforderlich." }),
  link: z.string().optional(),
  icon: z.string().optional(),
});

type AddMenuItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddMenuItemDialog({ open, onOpenChange }: AddMenuItemDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", link: "", icon: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('create-menu-item', {
        body: { ...values, position: 999 }, // Add at the end
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Menüpunkt erstellt!");
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuen Menüpunkt hinzufügen</DialogTitle>
          <DialogDescription>Geben Sie die Details für den neuen Menüpunkt ein.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="z.B. Dashboard" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="link" render={({ field }) => (
              <FormItem>
                <FormLabel>Link</FormLabel>
                <FormControl><Input placeholder="/dashboard oder https://..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="icon" render={({ field }) => (
              <FormItem>
                <FormLabel>Icon Name (optional)</FormLabel>
                <FormControl><Input placeholder="z.B. Home" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Wird erstellt..." : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}