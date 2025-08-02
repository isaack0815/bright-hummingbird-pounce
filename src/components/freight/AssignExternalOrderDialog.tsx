import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, Modal, Form } from 'react-bootstrap';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useError } from '@/contexts/ErrorContext';
import type { FreightOrder } from '@/types/freight';
import { generateExternalOrderPDF } from '@/utils/pdfGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { Mail, Loader2 } from 'lucide-react';

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
      const { data, error } = await supabase.functions.invoke('send-order-email', {
        body: { orderId },
      });
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.functions.invoke('cancel-external-assignment', {
        body: { orderId: order.id },
      });
      if (error) throw error;
      return data;
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
    <Modal show={open} onHide={() => onOpenChange(false)} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{isAssigned ? 'Externe Vergabe verwalten' : 'Auftrag extern vergeben'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isAssigned ? (
          <div className="d-flex flex-column gap-4 py-2 small">
            <h3 className="h5">Details Externer Transport</h3>
            <div>
              <h4 className="h6 text-muted mb-2">Transporteur</h4>
              <div className="ps-3 border-start d-flex flex-column gap-1">
                <p><strong>Anschrift:</strong><br/>{order.external_company_address?.split('\n').map((line, i) => <span key={i}>{line}<br/></span>) || '-'}</p>
                <p><strong>E-Mail:</strong> {order.external_email || '-'}</p>
              </div>
            </div>
            <div>
              <h4 className="h6 text-muted mb-2">Fahrer & Fahrzeug</h4>
              <div className="ps-3 border-start d-flex flex-column gap-1">
                <p><strong>Fahrer:</strong> {order.external_driver_name || '-'}</p>
                <p><strong>Telefon:</strong> {order.external_driver_phone || '-'}</p>
                <p><strong>Kennzeichen:</strong> {order.external_license_plate || '-'}</p>
              </div>
            </div>
          </div>
        ) : (
          <Form id="assign-external-form" onSubmit={form.handleSubmit((v) => assignMutation.mutate(v))}>
            <p className="text-muted">Füllen Sie die Daten des externen Dienstleisters aus.</p>
            <Form.Group className="mb-3"><Form.Label>Anschrift der Firma</Form.Label><Form.Control as="textarea" {...form.register("external_company_address")} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>E-Mail-Adresse</Form.Label><Form.Control type="email" {...form.register("external_email")} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Fahrername</Form.Label><Form.Control {...form.register("external_driver_name")} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Fahrer Telefon</Form.Label><Form.Control {...form.register("external_driver_phone")} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Kennzeichen</Form.Label><Form.Control {...form.register("external_license_plate")} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Transportermaße (LxBxH)</Form.Label><Form.Control {...form.register("external_transporter_dimensions")} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Zahlungsfrist (Tage)</Form.Label><Form.Control type="number" {...form.register("payment_term_days")} /></Form.Group>
            <Form.Check 
              type="checkbox"
              id="send-email"
              label="Transportauftrag nach Speichern per E-Mail senden"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              disabled={!form.watch('external_email')}
            />
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        {isAssigned ? (
          <>
            <Button variant="danger" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? 'Wird storniert...' : 'Vergabe stornieren'}
            </Button>
            <Button variant="outline-secondary" onClick={() => emailMutation.mutate(order.id)} disabled={emailMutation.isPending || !order.external_email}>
              {emailMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Mail className="me-2 h-4 w-4" />}
              E-Mail erneut senden
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" form="assign-external-form" disabled={assignMutation.isPending}>
              {assignMutation.isPending ? 'Wird vergeben...' : 'Extern vergeben & PDF erstellen'}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}