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
import { useQueryClient, useMutation } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich."),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.coerce.number().min(0, "Preis muss positiv sein."),
  stock_quantity: z.coerce.number().int("Menge muss eine ganze Zahl sein.").min(0, "Menge muss positiv sein."),
});

type AddProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddProductDialog({ open, onOpenChange }: AddProductDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", sku: "", price: 0, stock_quantity: 0 },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('create-product', { body: values });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Produkt erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen des Produkts."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Neues Produkt hinzufügen</DialogTitle>
          <DialogDescription>Füllen Sie die Details für das neue Produkt aus.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Produktname</FormLabel>
                <FormControl><Input placeholder="z.B. Super-Widget" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
             <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Beschreibung</FormLabel>
                <FormControl><Textarea placeholder="Beschreiben Sie das Produkt..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Preis (€)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stock_quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lagerbestand</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="sku" render={({ field }) => (
              <FormItem>
                <FormLabel>SKU (Artikelnummer)</FormLabel>
                <FormControl><Input placeholder="z.B. WID-001" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Wird erstellt..." : "Produkt erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}