import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Container, Card, Button, Form, Row, Col, Table, Spinner, Alert, InputGroup, Modal } from 'react-bootstrap';
import { Save, Trash2 } from 'lucide-react';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { AddCustomerDialog } from '@/components/AddCustomerDialog';
import { showError, showSuccess } from '@/utils/toast';
import type { Customer } from '@/pages/CustomerManagement';
import Select from 'react-select';

const IMPORT_FIELDS = [
  { key: 'external_order_number', label: 'Externe Auftragsnr.', required: false },
  { key: 'origin_address', label: 'Abholadresse', required: true },
  { key: 'pickup_date', label: 'Abholdatum', required: false },
  { key: 'destination_address', label: 'Lieferadresse', required: true },
  { key: 'delivery_date', label: 'Lieferdatum', required: false },
  { key: 'price', label: 'Preis', required: false },
  { key: 'description', label: 'Beschreibung', required: false },
];

type Template = {
  id: number;
  template_name: string;
  mapping: Record<string, string[]>;
};

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase.functions.invoke('manage-customers', {
    body: { action: 'get' }
  });
  if (error) throw new Error(error.message);
  return data.customers;
};

const fetchTemplates = async (customerId: number): Promise<Template[]> => {
  const { data, error } = await supabase.functions.invoke('manage-order-import', {
    body: { action: 'get-templates', payload: { customerId } },
  });
  if (error) throw error;
  return data.templates;
};

const OrderImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string[]>>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const queryClient = useQueryClient();

  const { data: customers } = useQuery<Customer[]>({ queryKey: ['customers'], queryFn: fetchCustomers });
  const { data: templates } = useQuery({
    queryKey: ['importTemplates', selectedCustomerId],
    queryFn: () => fetchTemplates(selectedCustomerId!),
    enabled: !!selectedCustomerId,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length > 0) {
          setHeaders(jsonData[0].map(h => String(h)));
          setRows(jsonData.slice(1));
          setMapping({});
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleMappingChange = (systemField: string, excelHeaders: string[]) => {
    setMapping(prev => ({ ...prev, [systemField]: excelHeaders }));
  };

  const previewData = useMemo(() => {
    if (rows.length === 0 || Object.keys(mapping).length === 0) return [];
    const headerIndexMap: Record<string, number> = {};
    headers.forEach((h, i) => { headerIndexMap[h] = i; });

    return rows.map(row => {
      const rowData: Record<string, any> = {};
      IMPORT_FIELDS.forEach(field => {
        const excelHeaders = mapping[field.key];
        if (excelHeaders && excelHeaders.length > 0) {
          const value = excelHeaders.map(header => {
            const index = headerIndexMap[header];
            let cellValue = row[index];
            if (cellValue instanceof Date) {
              cellValue = cellValue.toISOString().split('T')[0];
            }
            return cellValue;
          }).filter(Boolean).join(' ');
          rowData[field.key] = value;
        }
      });
      return rowData;
    }).filter(row => Object.values(row).some(val => val !== undefined && val !== null && val !== ''));
  }, [rows, headers, mapping]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId || previewData.length === 0) throw new Error("Kunde oder Daten fehlen.");
      const { data, error } = await supabase.functions.invoke('manage-order-import', { 
        body: { 
          action: 'import-orders', 
          payload: { customerId: selectedCustomerId, orders: previewData } 
        } 
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess(`${data.successCount} von ${data.totalCount} Aufträgen importiert!`);
      if (data.errorCount > 0) showError(`${data.errorCount} Aufträge fehlerhaft.`);
      setFile(null); setHeaders([]); setRows([]); setMapping({});
    },
    onError: (err: any) => showError(err.data?.error || err.message),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId || !newTemplateName) throw new Error("Kunden-ID oder Vorlagenname fehlt.");
      const { error } = await supabase.functions.invoke('manage-order-import', { 
        body: { 
          action: 'save-template', 
          payload: { 
            customerId: selectedCustomerId, 
            templateName: newTemplateName, 
            mapping 
          } 
        } 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Vorlage gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['importTemplates', selectedCustomerId] });
      setShowSaveTemplateModal(false);
      setNewTemplateName("");
    },
    onError: (err: any) => showError(err.data?.error || err.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const { error } = await supabase.functions.invoke('manage-order-import', {
        body: { action: 'delete-template', payload: { templateId } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Vorlage gelöscht!");
      queryClient.invalidateQueries({ queryKey: ['importTemplates', selectedCustomerId] });
      setSelectedTemplateId(null);
      setMapping({});
    },
    onError: (err: any) => showError(err.data?.error || err.message),
  });

  const isMappingComplete = IMPORT_FIELDS.filter(f => f.required).every(f => mapping[f.key] && mapping[f.key].length > 0);
  const headerOptions = headers.map(h => ({ value: h, label: h }));

  return (
    <>
      <h1 className="h2 mb-4">Auftragsimport via XLSX</h1>
      <Row className="g-4">
        <Col lg={5}>
          <Card className="mb-4">
            <Card.Header><Card.Title as="h6">1. Datei & Kunde auswählen</Card.Title></Card.Header>
            <Card.Body>
              <Form.Group className="mb-3"><Form.Label>XLSX-Datei</Form.Label><Form.Control type="file" accept=".xlsx, .xls" onChange={handleFileChange} /></Form.Group>
              {file && (
                <Form.Group><Form.Label>Kunde</Form.Label><CustomerCombobox customers={customers || []} value={selectedCustomerId} onChange={(val) => setSelectedCustomerId(val)} onAddNew={() => setIsAddCustomerDialogOpen(true)} /></Form.Group>
              )}
            </Card.Body>
          </Card>
          {headers.length > 0 && selectedCustomerId && (
            <Card>
              <Card.Header><Card.Title as="h6">2. Spalten zuordnen</Card.Title></Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>Vorlage anwenden</Form.Label>
                  <InputGroup>
                    <Select 
                      className="flex-grow-1"
                      options={templates?.map(t => ({ value: t.id, label: t.template_name }))} 
                      isClearable 
                      placeholder="Vorlage auswählen..." 
                      value={templates?.map(t => ({ value: t.id, label: t.template_name })).find(o => o.value === selectedTemplateId) || null}
                      onChange={(opt) => {
                        const selectedTemplate = templates?.find(t => t.id === opt?.value);
                        setSelectedTemplateId(opt?.value || null);
                        if (selectedTemplate) setMapping(selectedTemplate.mapping);
                        else setMapping({});
                      }} 
                    />
                    {selectedTemplateId && (
                      <Button variant="outline-danger" onClick={() => deleteTemplateMutation.mutate(selectedTemplateId)} disabled={deleteTemplateMutation.isPending}>
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </InputGroup>
                </Form.Group>
                <hr />
                {IMPORT_FIELDS.map(field => (
                  <Form.Group className="mb-2" key={field.key}>
                    <Form.Label>{field.label} {field.required && <span className="text-danger">*</span>}</Form.Label>
                    <Select isMulti options={headerOptions} value={headerOptions.filter(o => mapping[field.key]?.includes(o.value))} onChange={(opts) => handleMappingChange(field.key, opts.map(o => o.value))} />
                  </Form.Group>
                ))}
                <Button variant="outline-secondary" size="sm" className="mt-3" onClick={() => setShowSaveTemplateModal(true)} disabled={Object.keys(mapping).length === 0}><Save size={14} className="me-2" />Aktuelle Zuordnung als Vorlage speichern</Button>
              </Card.Body>
            </Card>
          )}
        </Col>
        <Col lg={7}>
          <Card>
            <Card.Header><Card.Title as="h6">3. Vorschau & Import</Card.Title></Card.Header>
            <Card.Body>
              {!isMappingComplete || !selectedCustomerId ? (
                <div className="text-center text-muted py-5"><p>Bitte laden Sie eine Datei hoch, wählen Sie einen Kunden und ordnen Sie alle Pflichtfelder (*) zu.</p></div>
              ) : (
                <>
                  <Alert variant="info">Es werden <strong>{previewData.length}</strong> Aufträge für <strong>{customers?.find(c => c.id === selectedCustomerId)?.company_name}</strong> importiert.</Alert>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}><Table striped bordered hover size="sm"><thead><tr>{IMPORT_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}</tr></thead><tbody>{previewData.slice(0, 10).map((row, i) => (<tr key={i}>{IMPORT_FIELDS.map(f => <td key={f.key}>{String(row[f.key] ?? '')}</td>)}</tr>))}</tbody></Table></div>
                  {previewData.length > 10 && <p className="small text-muted text-center">... und {previewData.length - 10} weitere Zeilen.</p>}
                  <div className="d-grid mt-3"><Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>{importMutation.isPending ? <Spinner size="sm" /> : `Import starten`}</Button></div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <AddCustomerDialog show={isAddCustomerDialogOpen} onHide={() => setIsAddCustomerDialogOpen(false)} onCustomerCreated={(c) => { setSelectedCustomerId(c.id); setIsAddCustomerDialogOpen(false); }} />
      <Modal show={showSaveTemplateModal} onHide={() => setShowSaveTemplateModal(false)}>
        <Modal.Header closeButton><Modal.Title>Vorlage speichern</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group><Form.Label>Name der Vorlage</Form.Label><Form.Control value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="z.B. Monatsabrechnung" /></Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveTemplateModal(false)}>Abbrechen</Button>
          <Button onClick={() => saveTemplateMutation.mutate()} disabled={!newTemplateName || saveTemplateMutation.isPending}>{saveTemplateMutation.isPending ? <Spinner size="sm" /> : "Speichern"}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default OrderImport;