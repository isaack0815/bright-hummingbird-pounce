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

const baseImportFields = [
  { key: 'external_order_number', label: 'Externe Auftragsnr.', required: false },
  { key: 'price', label: 'Preis', required: false },
  { key: 'description', label: 'Beschreibung', required: false },
  { key: 'weight', label: 'Gewicht (kg)', required: false },
  { key: 'loading_meters', label: 'Lademeter', required: false },
];

const stopFields = Array.from({ length: 5 }, (_, i) => ([
  { key: `stop_${i + 1}_address`, label: `Stopp ${i + 1} Adresse`, required: i === 0 },
  { key: `stop_${i + 1}_type`, label: `Stopp ${i + 1} Typ`, required: false },
  { key: `stop_${i + 1}_date`, label: `Stopp ${i + 1} Datum`, required: false },
]));

const IMPORT_FIELDS = [...baseImportFields, ...stopFields.flat()];

type Template = {
  id: number;
  template_name: string;
  mapping: Record<string, string>;
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
  return data.templates || [];
};

// Helper function to extract data from cells/ranges
const extractCellData = (worksheet: XLSX.WorkSheet, mappingString: string): string => {
  if (!mappingString || !worksheet) return '';
  
  try {
    if (mappingString.includes(':')) {
      // It's a range
      const range = XLSX.utils.decode_range(mappingString);
      const values = [];
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_address = { c: C, r: R };
          const cell_ref = XLSX.utils.encode_cell(cell_address);
          const cell = worksheet[cell_ref];
          if (cell && cell.v) {
            values.push(cell.w || cell.v);
          }
        }
      }
      return values.join(' ');
    } else {
      // It's a single cell
      const cell = worksheet[mappingString];
      return cell ? String(cell.w || cell.v) : '';
    }
  } catch (e) {
    console.error(`Error parsing mapping string "${mappingString}":`, e);
    return `[Fehlerhafte Eingabe: ${mappingString}]`;
  }
};

const OrderImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateToSave, setTemplateToSave] = useState<{id?: number, name: string}>({name: ''});
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
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        setWorkbook(wb);
        setMapping({});
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleMappingChange = (systemField: string, cellRef: string) => {
    setMapping(prev => ({ ...prev, [systemField]: cellRef }));
  };

  const previewData = useMemo(() => {
    if (!workbook || Object.keys(mapping).length === 0) return [];
    
    return workbook.SheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const rowData: Record<string, any> = {};
      IMPORT_FIELDS.forEach(field => {
        const mappingString = mapping[field.key];
        if (mappingString) {
          let value = extractCellData(worksheet, mappingString);
          if ((field.key.includes('date')) && value) {
            // Attempt to parse common date formats
            const dateMatch = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            if (dateMatch) {
              value = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            }
          }
          rowData[field.key] = value;
        }
      });
      return rowData;
    }).filter(row => Object.values(row).some(val => val));
  }, [workbook, mapping]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId || previewData.length === 0) throw new Error("Kunde oder Daten fehlen.");
      
      const ordersToImport = previewData.map(order => {
        const stops = [];
        for (let i = 1; i <= 5; i++) {
          if (order[`stop_${i}_address`]) {
            stops.push({
              address: order[`stop_${i}_address`],
              stop_type: order[`stop_${i}_type`] || (i === 1 ? 'Abholung' : 'Lieferung'),
              stop_date: order[`stop_${i}_date`] || null,
              position: i - 1,
            });
          }
        }
        
        const { ...rest } = order;
        // Remove stop fields from the main object
        for (let i = 1; i <= 5; i++) {
          delete rest[`stop_${i}_address`];
          delete rest[`stop_${i}_type`];
          delete rest[`stop_${i}_date`];
        }

        return { ...rest, stops };
      });

      const { data, error } = await supabase.functions.invoke('manage-order-import', { 
        body: { 
          action: 'import-orders', 
          payload: { customerId: selectedCustomerId, orders: ordersToImport } 
        } 
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess(`${data.successCount} von ${data.totalCount} Aufträgen importiert!`);
      if (data.errorCount > 0) showError(`${data.errorCount} Aufträge fehlerhaft.`);
      setFile(null); setWorkbook(null); setMapping({});
    },
    onError: (err: any) => showError(err.data?.error || err.message),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId || !templateToSave.name) throw new Error("Kunden-ID oder Vorlagenname fehlt.");
      const payload = { 
        customerId: selectedCustomerId, 
        templateName: templateToSave.name, 
        mapping,
        templateId: templateToSave.id
      };
      const { error } = await supabase.functions.invoke('manage-order-import', { 
        body: { action: 'save-template', payload } 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Vorlage gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['importTemplates', selectedCustomerId] });
      setShowSaveTemplateModal(false);
    },
    onError: (err: any) => {
      if (err.message.includes("unique_template_name_for_customer")) {
        showError("Eine Vorlage mit diesem Namen existiert bereits für diesen Kunden.");
      } else {
        showError(err.data?.error || err.message);
      }
    },
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

  const handleOpenSaveTemplateModal = () => {
    const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);
    if (selectedTemplate) {
      setTemplateToSave({ id: selectedTemplate.id, name: selectedTemplate.template_name });
    } else {
      setTemplateToSave({ name: '' });
    }
    setShowSaveTemplateModal(true);
  };

  const isMappingComplete = IMPORT_FIELDS.filter(f => f.required).every(f => mapping[f.key]);

  return (
    <>
      <h1 className="h2 mb-4">Auftragsimport via XLSX</h1>
      <Row className="g-4">
        <Col lg={5}>
          <Card className="mb-4">
            <Card.Header><Card.Title as="h6">1. Datei & Kunde auswählen</Card.Title></Card.Header>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label>XLSX-Datei</Form.Label>
                <Form.Control type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
              </Form.Group>
              {!file && (
                <Alert variant="info">
                  <Alert.Heading as="h6">Wie funktioniert der Import?</Alert.Heading>
                  <p className="small">
                    Laden Sie eine Excel-Datei hoch. Das System geht davon aus, dass jedes Tabellenblatt (Sheet) in der Datei einen einzelnen Auftrag darstellt.
                    Im nächsten Schritt können Sie dann die Systemfelder (z.B. "Abholadresse") mit den entsprechenden Zellen (z.B. `B5`) oder Zellbereichen (z.B. `B12:B15`) aus Ihrer Datei verknüpfen.
                  </p>
                </Alert>
              )}
              {file && (
                <Form.Group>
                  <Form.Label>Kunde</Form.Label>
                  <CustomerCombobox customers={customers || []} value={selectedCustomerId} onChange={(val) => setSelectedCustomerId(val)} onAddNew={() => setIsAddCustomerDialogOpen(true)} />
                </Form.Group>
              )}
            </Card.Body>
          </Card>
          {workbook && selectedCustomerId && (
            <Card>
              <Card.Header><Card.Title as="h6">2. Zellen zuordnen</Card.Title></Card.Header>
              <Card.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
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
                    <Form.Control 
                      placeholder="z.B. B5 oder A10:C12" 
                      value={mapping[field.key] || ''}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                    />
                  </Form.Group>
                ))}
                <Button variant="outline-secondary" size="sm" className="mt-3" onClick={handleOpenSaveTemplateModal} disabled={Object.keys(mapping).length === 0}><Save size={14} className="me-2" />Aktuelle Zuordnung als Vorlage speichern</Button>
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
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}><Table striped bordered hover size="sm"><thead><tr>{IMPORT_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}</tr></thead><tbody>{previewData.map((row, i) => (<tr key={i}>{IMPORT_FIELDS.map(f => <td key={f.key}>{String(row[f.key] ?? '')}</td>)}</tr>))}</tbody></Table></div>
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
          <Form.Group><Form.Label>Name der Vorlage</Form.Label><Form.Control value={templateToSave.name} onChange={(e) => setTemplateToSave(prev => ({...prev, name: e.target.value}))} placeholder="z.B. Monatsabrechnung" /></Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveTemplateModal(false)}>Abbrechen</Button>
          <Button onClick={() => saveTemplateMutation.mutate()} disabled={!templateToSave.name || saveTemplateMutation.isPending}>{saveTemplateMutation.isPending ? <Spinner size="sm" /> : "Speichern"}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default OrderImport;