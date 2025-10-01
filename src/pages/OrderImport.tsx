import { useState } from 'react';
import { Card, Button, Form, Spinner, Alert, ListGroup } from 'react-bootstrap';
import { Upload, FileText } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import type { Customer } from '@/pages/CustomerManagement';
import Select from 'react-select';

type ImportTemplate = {
  id: number;
  template_name: string;
  customer_id: number;
};

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase.functions.invoke('customers', {
    method: 'GET',
  });
  if (error) throw new Error(error.message);
  return data.customers;
};

const fetchTemplates = async (): Promise<ImportTemplate[]> => {
  const { data, error } = await supabase.from('import_templates').select('*');
  if (error) throw error;
  return data;
};

const OrderImport = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; createdOrders?: any[] } | null>(null);

  const { data: customers, isLoading: isLoadingCustomers } = useQuery({ queryKey: ['customers'], queryFn: fetchCustomers });
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({ queryKey: ['importTemplates'], queryFn: fetchTemplates });

  const importMutation = useMutation({
    mutationFn: async (fileContent: string) => {
      const { data, error } = await supabase.functions.invoke('import-orders', {
        body: {
          customerId: selectedCustomerId,
          templateId: selectedTemplateId,
          fileContent,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message);
      setImportResult(data);
      setSelectedFile(null);
    },
    onError: (err: any) => {
      showError(err.data?.error || "Fehler beim Import.");
      setImportResult({ success: false, message: err.data?.error || "Fehler beim Import." });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (!selectedFile || !selectedCustomerId || !selectedTemplateId) {
      showError("Bitte wählen Sie einen Kunden, eine Vorlage und eine Datei aus.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      importMutation.mutate(content);
    };
    reader.readAsText(selectedFile);
  };

  const customerOptions = customers?.map(c => ({ value: c.id, label: c.company_name })) || [];
  const templateOptions = templates
    ?.filter(t => t.customer_id === selectedCustomerId)
    .map(t => ({ value: t.id, label: t.template_name })) || [];

  return (
    <div>
      <h1 className="h2 mb-4">Auftragsimport per CSV</h1>
      <Card>
        <Card.Header>
          <Card.Title>Import starten</Card.Title>
          <Card.Text className="text-muted">Wählen Sie einen Kunden, eine Vorlage und eine CSV-Datei zum Hochladen.</Card.Text>
        </Card.Header>
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>1. Kunde auswählen</Form.Label>
            <Select
              options={customerOptions}
              isLoading={isLoadingCustomers}
              onChange={(opt) => setSelectedCustomerId(opt?.value || null)}
              placeholder="Kunde auswählen..."
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>2. Importvorlage auswählen</Form.Label>
            <Select
              options={templateOptions}
              isLoading={isLoadingTemplates}
              onChange={(opt) => setSelectedTemplateId(opt?.value || null)}
              placeholder="Vorlage auswählen..."
              isDisabled={!selectedCustomerId}
              noOptionsMessage={() => "Für diesen Kunden sind keine Vorlagen vorhanden."}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>3. CSV-Datei auswählen</Form.Label>
            <Form.Control type="file" accept=".csv" onChange={handleFileChange} />
          </Form.Group>
          <Button onClick={handleImport} disabled={!selectedFile || importMutation.isPending}>
            {importMutation.isPending ? (
              <>
                <Spinner as="span" size="sm" className="me-2" />
                Importiere...
              </>
            ) : (
              <>
                <Upload className="me-2" size={16} />
                Datei verarbeiten
              </>
            )}
          </Button>
        </Card.Body>
      </Card>

      {importResult && (
        <Card className="mt-4">
          <Card.Header>
            <Card.Title>Importergebnis</Card.Title>
          </Card.Header>
          <Card.Body>
            <Alert variant={importResult.success ? 'success' : 'danger'}>
              {importResult.message}
            </Alert>
            {importResult.success && importResult.createdOrders && (
              <>
                <h6>Erstellte Aufträge:</h6>
                <ListGroup>
                  {importResult.createdOrders.map((order: any) => (
                    <ListGroup.Item key={order.id}>
                      <FileText size={16} className="me-2" />
                      Auftrag <span className="fw-bold">{order.order_number}</span> wurde erstellt.
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default OrderImport;