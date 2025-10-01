import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Container, Card, Button, Form, Row, Col, Table, Spinner, Alert, InputGroup, Modal, Accordion } from 'react-bootstrap';
import { Save, Trash2, PlusCircle, Upload, Users, GitBranch, Eye } from 'lucide-react';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { AddCustomerDialog } from '@/components/AddCustomerDialog';
import { showError, showSuccess } from '@/utils/toast';
import type { Customer } from '@/pages/CustomerManagement';
import Select from 'react-select';
import { FileUploader } from '@/components/FileUploader';

const baseImportFields = [
  { key: 'external_order_number', label: 'Externe Auftragsnr.', required: false },
  { key: 'price', label: 'Preis', required: false },
  { key: 'description', label: 'Beschreibung', required: false },
  { key: 'weight', label: 'Gewicht (kg)', required: false },
  { key: 'loading_meters', label: 'Lademeter', required: false },
];

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

const extractCellData = (worksheet: XLSX.WorkSheet, mappingString: string): string => {
  if (!mappingString || !worksheet) return '';
  try {
    if (mappingString.includes(':')) {
      const range = XLSX.utils.decode_range(mappingString);
      const values = [];
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_address = { c: C, r: R };
          const cell_ref = XLSX.utils.encode_cell(cell_address);
          const cell = worksheet[cell_ref];
          if (cell && cell.v) values.push(cell.w || cell.v);
        }
      }
      return values.join(' ');
    } else {
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
  const [stopCount, setStopCount] = useState(2);
  const queryClient = useQueryClient();

  const { data: customers } = useQuery<Customer[]>({ queryKey: ['customers'], queryFn: fetchCustomers });
  const { data: templates } = useQuery({
    queryKey: ['importTemplates', selectedCustomerId],
    queryFn: () => fetchTemplates(selectedCustomerId!),
    enabled: !!selectedCustomerId,
  });

  const IMPORT_FIELDS = useMemo(() => {
    const dynamicStopFields = [];
    for (let i = 1; i <= stopCount; i++) {
      dynamicStopFields.push(
        { key: `stop_${i}_address`, label: `Stopp ${i} Adresse`, required: i <= 2 },
        { key: `stop_${i}_type`, label: `Stopp ${i} Typ`, required: false },
        { key: `stop_${i}_date`, label: `Stopp ${i} Datum`, required: false },
      );
    }
    return [...baseImportFields, ...dynamicStopFields];
  }, [stopCount]);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        setWorkbook(wb);
        setMapping({});
        setStopCount(2);
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setFile(null);
      setWorkbook(null);
      setMapping({});
    }
  };

  const handleMappingChange = (systemField: string, cellRef: string) => {
    setMapping(prev => ({ ...prev, [systemField]: cellRef.toUpperCase() }));
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
            const dateMatch = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            if (dateMatch) value = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          }
          rowData[field.key] = value;
        }
      });
      return rowData;
    }).filter(row => Object.values(row).some(val => val));
  }, [workbook, mapping, IMPORT_FIELDS]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId || previewData.length === 0) throw new Error("Kunde oder Daten fehlen.");
      const ordersToImport = previewData.map(order => {
        const stops = [];
        for (let i = 1; i <= stopCount; i++) {
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
        for (let i = 1; i <= stopCount; i++) {
          delete rest[`stop_${i}_address`]; delete rest[`stop_${i}_type`]; delete rest[`stop_${i}_date`];
        }
        return { ...rest, stops };
      });
      const { data, error } = await supabase.functions.invoke('manage-order-import', { body: { action: 'import-orders', payload: { customerId: selectedCustomerId, orders: ordersToImport } } });
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
      const payload = { customerId: selectedCustomerId, templateName: templateToSave.name, mapping, templateId: templateToSave.id };
      const { error } = await supabase.functions.invoke('manage-order-import', { body: { action: 'save-template', payload } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Vorlage gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['importTemplates', selectedCustomerId] });
      setShowSaveTemplateModal(false);
    },
    onError: (err: any) => {
      if (err.message.includes("unique_template_name_for_customer")) showError("Eine Vorlage mit diesem Namen existiert bereits für diesen Kunden.");
      else showError(err.data?.error || err.message);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const { error } = await supabase.functions.invoke('manage-order-import', { body: { action: 'delete-template', payload: { templateId } } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Vorlage gelöscht!");
      queryClient.invalidateQueries({ queryKey: ['importTemplates', selectedCustomerId] });
      setSelectedTemplateId(null); setMapping({});
    },
    onError: (err: any) => showError(err.data?.error || err.message),
  });

  const handleOpenSaveTemplateModal = () => {
    const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);
    setTemplateToSave(selectedTemplate ? { id: selectedTemplate.id, name: selectedTemplate.template_name } : { name: '' });
    setShowSaveTemplateModal(true);
  };

  const isMappingComplete = IMPORT_FIELDS.filter(f => f.required).every(f => mapping[f.key]);
  const showMapping = !!file && !!selectedCustomerId;
  const showPreview = showMapping && isMappingComplete;

  return (
    <>
      <div className="mb-4">
        <h1 className="h2">Auftragsimport via XLSX</h1>
        <p className="text-muted">Importieren Sie Kundenaufträge schnell und einfach aus einer Excel-Datei.</p>
      </div>
      <div className="d-flex flex-column gap-4">
        <Card className="shadow-sm">
          <Card.Header className="d-flex align-items-center gap-2">
            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px' }}>1</div>
            <Card.Title as="h6" className="mb-0">Einrichtung</Card.Title>
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="d-flex align-items-center"><Upload size={16} className="me-2" />XLSX-Datei</Form.Label>
                  <FileUploader onFileSelect={handleFileChange} />
                </Form.Group>
              </Col>
              <Col md={6}>
                {file && (
                  <Form.Group>
                    <Form.Label className="d-flex align-items-center"><Users size={16} className="me-2" />Kunde</Form.Label>
                    <CustomerCombobox customers={customers || []} value={selectedCustomerId} onChange={(val) => setSelectedCustomerId(val)} onAddNew={() => setIsAddCustomerDialogOpen(true)} />
                  </Form.Group>
                )}
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {showMapping && (
          <Card className="shadow-sm">
            <Card.Header className="d-flex align-items-center gap-2">
              <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px' }}>2</div>
              <Card.Title as="h6" className="mb-0">Zuordnung</Card.Title>
            </Card.Header>
            <Card.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <Form.Group className="mb-3">
                <Form.Label>Vorlage anwenden</Form.Label>
                <InputGroup>
                  <Select className="flex-grow-1" options={templates?.map(t => ({ value: t.id, label: t.template_name }))} isClearable placeholder="Vorlage auswählen..." value={templates?.map(t => ({ value: t.id, label: t.template_name })).find(o => o.value === selectedTemplateId) || null} onChange={(opt) => { const t = templates?.find(t => t.id === opt?.value); setSelectedTemplateId(opt?.value || null); setMapping(t ? t.mapping : {}); }} />
                  <Button variant="outline-danger" onClick={() => selectedTemplateId && deleteTemplateMutation.mutate(selectedTemplateId)} disabled={!selectedTemplateId || deleteTemplateMutation.isPending}><Trash2 size={16} /></Button>
                </InputGroup>
              </Form.Group>
              <hr />
              <Accordion defaultActiveKey="0">
                <Accordion.Item eventKey="0">
                  <Accordion.Header>Allgemeine Auftragsdaten</Accordion.Header>
                  <Accordion.Body>
                    {baseImportFields.map(field => (<Form.Group className="mb-2" key={field.key}><Form.Label>{field.label}</Form.Label><Form.Control placeholder="z.B. B5" value={mapping[field.key] || ''} onChange={(e) => handleMappingChange(field.key, e.target.value)} /></Form.Group>))}
                  </Accordion.Body>
                </Accordion.Item>
                <Accordion.Item eventKey="1">
                  <Accordion.Header>Routen-Stopps</Accordion.Header>
                  <Accordion.Body>
                    {Array.from({ length: stopCount }).map((_, index) => (
                      <div key={`stop-group-${index}`} className="mb-3 p-2 border rounded">
                        <h6 className="small fw-bold">Stopp {index + 1}</h6>
                        <Form.Group className="mb-2"><Form.Label>Adresse {index < 2 && <span className="text-danger">*</span>}</Form.Label><Form.Control placeholder="z.B. B12:B15" value={mapping[`stop_${index + 1}_address`] || ''} onChange={(e) => handleMappingChange(`stop_${index + 1}_address`, e.target.value)} /></Form.Group>
                        <Form.Group className="mb-2"><Form.Label>Typ</Form.Label>
                          <InputGroup>
                            <Form.Select value={mapping[`stop_${index + 1}_type`]?.startsWith('=') ? mapping[`stop_${index + 1}_type`] : ''} onChange={(e) => handleMappingChange(`stop_${index + 1}_type`, e.target.value)} disabled={!!mapping[`stop_${index + 1}_type_cell`]}>
                              <option value="=Abholung">Abholung</option>
                              <option value="=Teilladung">Teilladung</option>
                              <option value="=Teillieferung">Teillieferung</option>
                              <option value="=Lieferung">Lieferung</option>
                            </Form.Select>
                            <Form.Control placeholder="Oder Zelle (z.B. C5)" value={mapping[`stop_${index + 1}_type_cell`] || ''} onChange={(e) => handleMappingChange(`stop_${index + 1}_type_cell`, e.target.value)} />
                          </InputGroup>
                        </Form.Group>
                        <Form.Group><Form.Label>Datum</Form.Label><Form.Control placeholder="z.B. C8" value={mapping[`stop_${index + 1}_date`] || ''} onChange={(e) => handleMappingChange(`stop_${index + 1}_date`, e.target.value)} /></Form.Group>
                      </div>
                    ))}
                    <Button variant="link" size="sm" onClick={() => setStopCount(c => c + 1)}><PlusCircle size={14} className="me-1" /> Weiteren Stopp hinzufügen</Button>
                  </Accordion.Body>
                </Accordion.Item>
              </Accordion>
              <hr />
              <Button variant="outline-secondary" size="sm" onClick={handleOpenSaveTemplateModal} disabled={Object.keys(mapping).length === 0}><Save size={14} className="me-2" />Aktuelle Zuordnung als Vorlage speichern</Button>
            </Card.Body>
          </Card>
        )}

        {showPreview && (
          <Card className="shadow-sm">
            <Card.Header className="d-flex align-items-center gap-2">
              <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px' }}>3</div>
              <Card.Title as="h6" className="mb-0">Vorschau & Import</Card.Title>
            </Card.Header>
            <Card.Body>
              <Alert variant="info">Es werden <strong>{previewData.length}</strong> Aufträge für <strong>{customers?.find(c => c.id === selectedCustomerId)?.company_name}</strong> importiert.</Alert>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table striped bordered hover size="sm">
                  <thead><tr>{IMPORT_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}</tr></thead>
                  <tbody>{previewData.map((row, i) => (<tr key={i}>{IMPORT_FIELDS.map(f => <td key={f.key}>{String(row[f.key] ?? '')}</td>)}</tr>))}</tbody>
                </Table>
              </div>
            </Card.Body>
            <Card.Footer className="text-end">
              <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
                {importMutation.isPending ? <><Spinner size="sm" className="me-2" />Wird importiert...</> : `Import starten`}
              </Button>
            </Card.Footer>
          </Card>
        )}
      </div>
      <AddCustomerDialog show={isAddCustomerDialogOpen} onHide={() => setIsAddCustomerDialogOpen(false)} onCustomerCreated={(c) => { setSelectedCustomerId(c.id); setIsAddCustomerDialogOpen(false); }} />
      <Modal show={showSaveTemplateModal} onHide={() => setShowSaveTemplateModal(false)}>
        <Modal.Header closeButton><Modal.Title>Vorlage speichern</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Name der Vorlage</Form.Label>
            <Form.Control value={templateToSave.name} onChange={(e) => setTemplateToSave(prev => ({...prev, name: e.target.value}))} placeholder="z.B. Monatsabrechnung" />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveTemplateModal(false)}>Abbrechen</Button>
          <Button onClick={() => saveTemplateMutation.mutate()} disabled={!templateToSave.name || saveTemplateMutation.isPending}>
            {saveTemplateMutation.isPending ? <Spinner size="sm" /> : "Speichern"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default OrderImport;