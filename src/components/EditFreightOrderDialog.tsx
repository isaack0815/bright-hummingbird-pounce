import { useEffect } from "react";
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
import type { FreightOrder } from "@/types/freight";

const formSchema = z.object({
  customer_id: z.coerce.number({ required_error: "Ein Kunde muss ausgewählt werden." }),
  status: z.string(),
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

type EditFreightOrderDialogProps = {
  order: FreightOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditFreightOrderDialog({ order, open, onOpenChange }: EditFreightOrderDialogProps) {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
    enabled: open,
  });

  useEffect(() => {
    if (order) {
      form.reset({
        customer_id: order.customer_id,
        status: order.status,
        origin_address: order.origin_address || "",
        destination_address: order.destination_address || "",
        pickup_date: order.pickup_date || "",
        delivery_date: order.delivery_date || "",
        cargo_description: order.cargo_description || "",
        price: order.price || undefined,
      });
    }
  }, [order, form, open]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!order) return;
      const { error } = await supabase.functions.invoke('update-freight-order', {
        body: { id: order.id, ...values },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Auftrag erfolgreich aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || "Fehler beim Aktualisieren des Auftrags.");
    },
  });

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Frachtauftrag #{order.id} bearbeiten</DialogTitle>
          <DialogDescription>Aktualisieren Sie die Auftragsdetails.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}>
            <ScrollArea className="h-96 p-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kunde</FormLabel>
                      <Select onValueChange={field.onChange} value={String(field.value)}>
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
                 <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Angelegt">Angelegt</SelectItem>
                          <SelectItem value="Unterwegs">Unterwegs</SelectItem>
                          <SelectItem value="Zugestellt">Zugestellt</SelectItem>
                          <SelectItem value="Storniert">Storniert</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="origin_address" render={({ field }) => (
                  <FormItem><FormLabel>Abholadresse</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="destination_address" render={({ field }) => (
                  <FormItem><FormLabel>Lieferadresse</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="pickup_date" render={({ field }) => (
                    <FormItem><FormLabel>Abholdatum</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="delivery_date" render={({ field }) => (
                    <FormItem><FormLabel>Lieferdatum</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="cargo_description" render={({ field }) => (
                  <FormItem><FormLabel>Frachtbeschreibung</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>Preis</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Wird gespeichert..." : "Änderungen speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}