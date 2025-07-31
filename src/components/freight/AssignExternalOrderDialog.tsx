import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useError } from '@/contexts/ErrorContext';
import type { FreightOrder } from '@/types/freight';
import { generateExternalOrderPDF } from '@/utils/pdfGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info, Mail, Loader2 } from 'lucide-react';

const formSchema = z.object({
  external_company_address: z.string().min(1, "Anschrift ist erforderlich."),
  external_email: z.string().email({ message: "Ungültige E-Mail." }).optional().or(z.literal('')),
  external_driver_name: z.string().optional(),
  external_driver_phone: z.string().optional(),
  external_license_plate: z.string().optional(),
  external_transporter_dimensions: z.string().optional(),
  payment_term_days: z.coerce.number().optional(),
});

type AssignExternalOrderDialogProps = {
  order: FreightOrder | null;
  settings: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssignExternalOrderDialog({ order, settings, open, onOpenChange }: AssignExternalOrderDialogProps) {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const { user } = useAuth();
  const [sendEmail, setSendEmail] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (order) {
      form.reset({
        external_company_address: order.external_company_address || '',
        external_email: order.external_email || '',
        external_driver_name: order.external_driver_name || '',
        external_driver_phone: order.external_driver_phone || '',
        external_license_plate: order.external_license_plate || '',
        external_transporter_dimensions: order.external_transporter_dimensions || '',
        payment_term_days: order.payment_term_days || Number(settings?.payment_term_default) || 45,
      });
    }
  }, [order, settings, form, open]);

  const emailMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase.functions.invoke('send-order-email', {
        body: { orderId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("E-Mail wurde erfolgreich versendet!");
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || "Fehler beim Senden der E-Mail.");
    },
  });

  const pdfMutation = useMutation({
    mutationFn: async (updatedOrder: FreightOrder) => {
      if (!settings || !user) throw new Error("Fehlende Daten für PDF-Erstellung");
      
      const sanitizedOrderNumber = updatedOrder.order_number.replace(/\//g, '_');
      const fileName = `Transportauftrag_${sanitizedOrderNumber}.pdf`;
      const filePath = `${updatedOrder.id}/${uuidv4()}-${fileName}`;

      const pdfBlob = generateExternalOrderPDF(updatedOrder, settings);

      const { error: uploadError } = await supabase.storage.from('order-files').upload(filePath, pdfBlob);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('order_files').insert({
        order_id: updatedOrder.id,
        user_id: user.id,
        file_path: filePath,
        file_name: fileName,
        file_type: 'application/pdf',
      });
      if (dbError) throw dbError;
      return updatedOrder;
    },
    onSuccess: (updatedOrder) => {
      showSuccess("PDF-Auftrag erfolgreich erstellt und gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['orderFiles', order?.id] });
      if (sendEmail) {
        emailMutation.mutate(updatedOrder.id);
      }
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.message || "Fehler beim Erstellen des PDFs.");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!order) return;
      const { data, error } = await supabase.from('freight_orders')
        .update({ ...values, is_external: true })
        .eq('id', order.id)
        .select('*, customers(id, company_name), freight_order_stops(*), cargo_items(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (updatedOrder) => {
      showSuccess("Auftrag erfolgreich extern vergeben!");
      pdfMutation.mutate(updatedOrder as FreightOrder);
      queryClient.invalidateQueries({ queryKey: ['freightOrder', order?.id] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || "Fehler beim Vergeben des Auftrags.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const { error } = await supabase.functions.invoke('cancel-external-assignment', {
        body: { orderId: order.id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Externe Vergabe storniert.");
      queryClient.invalidateQueries({ queryKey: ['freightOrder', order?.id] });
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || "Fehler beim Stornieren.");
    },
  });

  if (!order) return null;

  const isAssigned = order.is_external;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isAssigned ? 'Externe Vergabe verwalten' : 'Auftrag extern vergeben'}</DialogTitle>
          <DialogDescription>
            {isAssigned 
              ? `Dieser Auftrag ist an den folgenden Dienstleister vergeben.`
              : `Füllen Sie die Daten des externen Dienstleisters aus.`
            }
          </DialogDescription>
        </DialogHeader>
        
        {isAssigned ? (
          <div className="space-y-4 py-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Informationen zum Dienstleister</AlertTitle>
              <AlertDescription className="text-sm space-y-2 mt-2">
                <p><strong>Firma:</strong><br/>{order.external_company_address?.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</p>
                <p><strong>Fahrer:</strong> {order.external_driver_name || '-'}</p>
                <p><strong>Telefon:</strong> {order.external_driver_phone || '-'}</p>
                <p><strong>Kennzeichen:</strong> {order.external_license_plate || '-'}</p>
              </AlertDescription>
            </Alert>
            <DialogFooter className="sm:justify-between gap-2">
              <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                {cancelMutation.isPending ? 'Wird storniert...' : 'Vergabe stornieren'}
              </Button>
              <Button variant="outline" onClick={() => emailMutation.mutate(order.id)} disabled={emailMutation.isPending || !order.external_email}>
                {emailMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                E-Mail erneut senden
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => assignMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="external_company_address" render={({ field }) => (
                  <FormItem><FormLabel>Anschrift der Firma</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="external_email" render={({ field }) => (
                  <FormItem><FormLabel>E-Mail-Adresse</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="external_driver_name" render={({ field }) => (
                  <FormItem><FormLabel>Fahrername</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="external_driver_phone" render={({ field }) => (
                  <FormItem><FormLabel>Fahrer Telefon</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="external_license_plate" render={({ field }) => (
                  <FormItem><FormLabel>Kennzeichen</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="external_transporter_dimensions" render={({ field }) => (
                  <FormItem><FormLabel>Transportermaße (LxBxH)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="payment_term_days" render={({ field }) => (
                  <FormItem><FormLabel>Zahlungsfrist (Tage)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="send-email"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(Boolean(checked))}
                  disabled={!form.watch('external_email')}
                />
                <label
                  htmlFor="send-email"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Transportauftrag nach Speichern per E-Mail senden
                </label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={assignMutation.isPending}>
                  {assignMutation.isPending ? 'Wird vergeben...' : 'Extern vergeben & PDF erstellen'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}