import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import { showSuccess, showError } from '@/utils/toast';
import type { OrderFileWithDetails } from '@/types/files';

type ReassignFileDialogProps = {
  file: OrderFileWithDetails | null;
  show: boolean;
  onHide: () => void;
};

const fetchOrders = async () => {
  const { data, error } = await supabase.functions.invoke('get-all-order-numbers');
  if (error) throw error;
  return data.orders;
};

export const ReassignFileDialog = ({ file, show, onHide }: ReassignFileDialogProps) => {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['allOrderNumbers'],
    queryFn: fetchOrders,
    enabled: show,
  });

  const mutation = useMutation({
    mutationFn: async (newOrderId: number) => {
      if (!file) return;
      const { error } = await supabase.functions.invoke('reassign-order-file', {
        body: { fileId: file.id, newOrderId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Datei erfolgreich neu zugeordnet!");
      queryClient.invalidateQueries({ queryKey: ['allOrderFiles'] });
      onHide();
    },
    onError: (err: any) => {
      showError(err.message || "Fehler bei der Neuzuordnung.");
    },
  });

  const orderOptions = orders?.map((o: { id: number, order_number: string }) => ({
    value: o.id,
    label: o.order_number,
  })) || [];

  const handleSubmit = () => {
    if (selectedOrderId) {
      mutation.mutate(selectedOrderId);
    }
  };

  if (!file) return null;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Datei neu zuordnen</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Wählen Sie den neuen Auftrag für die Datei <strong>{file.file_name}</strong> aus.</p>
        <Form.Group>
          <Form.Label>Neuer Auftrag</Form.Label>
          <Select
            options={orderOptions}
            isLoading={isLoading}
            onChange={(option: any) => setSelectedOrderId(option?.value || null)}
            placeholder="Auftrag auswählen..."
            isClearable
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
        <Button onClick={handleSubmit} disabled={!selectedOrderId || mutation.isPending}>
          {mutation.isPending ? <Spinner size="sm" /> : 'Zuordnen'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};