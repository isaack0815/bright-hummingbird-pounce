import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useError } from "@/contexts/ErrorContext";
import type { Customer } from "@/pages/CustomerManagement";

const formSchema = z.object({
  customer_id: z.coerce.number({ required_error: "Ein Kunde muss ausgewählt werden." }),
  status: z.string().default('Angelegt'),
  origin_address: z.string().optional(),
  destination_address: z.string().optional(),
  pickup_date: z.string().optional(),
  delivery_date: z.string().optional(),
  cargo_description: z.string().optional(),
  price: z.coerce.number().optional(),
});

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase.functions.invoke('get-customers');
  if (error) throw new Error(error.message);
  return data.customers;
};

type AddFreightOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddFreightOrderDialog({ open, onOpenChange }: AddFreightOrderDialogProps) {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { status: 'Angelegt' },
  });

  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('create-freight-order', { body: values });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Auftrag erfolgreich erstellt!");
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || "Fehler beim Erstellen des Auftrags.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neuen Frachtauftrag anlegen</DialogTitle>
          <DialogDescription>Füllen Sie die Auftragsdetails aus.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <ScrollArea className="h-96 p-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kunde</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                        <FormControl>
                          <SelectTrigger disabled={isLoadingCustomers}>
                            <SelectValue placeholder="Wählen Sie einen Kunden" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="origin_address" render={({ field }) => (
                  <FormItem><FormLabel>Abholadresse</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="destination_address" render={({ field }) => (
                  <FormItem><FormLabel>Lieferadresse</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="pickup_date" render={({ field }) => (
                    <FormItem><FormLabel>Abholdatum</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="delivery_date" render={({ field }) => (
                    <FormItem><FormLabel>Lieferdatum</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="cargo_description" render={({ field }) => (
                  <FormItem><FormLabel>Frachtbeschreibung</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>Preis</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Wird erstellt..." : "Auftrag erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}