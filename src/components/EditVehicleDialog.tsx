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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useError } from "@/contexts/ErrorContext";
import type { Vehicle } from "@/types/vehicle";

const formSchema = z.object({
  license_plate: z.string().min(1, "Kennzeichen ist erforderlich."),
  brand: z.string().optional(),
  model: z.string().optional(),
  type: z.string().optional(),
  vin: z.string().optional(),
  year_of_manufacture: z.coerce.number().optional(),
  inspection_due_date: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
  loading_area: z.coerce.number().optional(),
  next_service_date: z.string().optional(),
  gas_inspection_due_date: z.string().optional(),
});

type EditVehicleDialogProps = {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditVehicleDialog({ vehicle, open, onOpenChange }: EditVehicleDialogProps) {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (vehicle) {
      form.reset({
        license_plate: vehicle.license_plate,
        brand: vehicle.brand || "",
        model: vehicle.model || "",
        type: vehicle.type || "",
        vin: vehicle.vin || "",
        year_of_manufacture: vehicle.year_of_manufacture || undefined,
        inspection_due_date: vehicle.inspection_due_date || "",
        status: vehicle.status,
        notes: vehicle.notes || "",
        loading_area: vehicle.loading_area || undefined,
        next_service_date: vehicle.next_service_date || "",
        gas_inspection_due_date: vehicle.gas_inspection_due_date || "",
      });
    }
  }, [vehicle, form, open]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!vehicle) return;
      const { error } = await supabase.functions.invoke('update-vehicle', {
        body: { id: vehicle.id, ...values },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Fahrzeug erfolgreich aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || "Fehler beim Aktualisieren des Fahrzeugs.");
    },
  });

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fahrzeug bearbeiten</DialogTitle>
          <DialogDescription>
            Aktualisieren Sie die Fahrzeugdaten.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}>
            <ScrollArea className="h-[60vh] p-4">
              <div className="space-y-4">
                <FormField control={form.control} name="license_plate" render={({ field }) => (
                  <FormItem><FormLabel>Kennzeichen</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="brand" render={({ field }) => (
                    <FormItem><FormLabel>Marke</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="model" render={({ field }) => (
                    <FormItem><FormLabel>Modell</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Fahrzeugtyp</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Sattelzugmaschine">Sattelzugmaschine</SelectItem>
                        <SelectItem value="Anhänger">Anhänger</SelectItem>
                        <SelectItem value="Transporter">Transporter</SelectItem>
                        <SelectItem value="LKW">LKW</SelectItem>
                      </SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="vin" render={({ field }) => (
                  <FormItem><FormLabel>Fahrgestellnummer (VIN)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="year_of_manufacture" render={({ field }) => (
                    <FormItem><FormLabel>Baujahr</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="loading_area" render={({ field }) => (
                    <FormItem><FormLabel>Ladefläche (m²)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="inspection_due_date" render={({ field }) => (
                    <FormItem><FormLabel>Nächste HU</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="next_service_date" render={({ field }) => (
                    <FormItem><FormLabel>Nächster Service</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="gas_inspection_due_date" render={({ field }) => (
                    <FormItem><FormLabel>Nächste Gasdurchsicht</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Verfügbar">Verfügbar</SelectItem>
                        <SelectItem value="In Reparatur">In Reparatur</SelectItem>
                        <SelectItem value="Unterwegs">Unterwegs</SelectItem>
                        <SelectItem value="Außer Betrieb">Außer Betrieb</SelectItem>
                      </SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notizen</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
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