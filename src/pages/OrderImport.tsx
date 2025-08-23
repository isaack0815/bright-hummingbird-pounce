import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Container, Card, Button, Form, Row, Col, Table, Spinner, Alert } from 'react-bootstrap';
import { ArrowRight } from 'lucide-react';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { AddCustomerDialog } from '@/components/AddCustomerDialog';
import { showError, showSuccess } from '@/utils/toast';
import type { Customer } from '@/pages/CustomerManagement';

// Define the fields we want to import into our system
const IMPORT_FIELDS = [
  { key: 'external_order_number', label: 'Externe Auftragsnr.', required: false },
  { key: 'origin_address', label: 'Abholadresse', required: true },
  { key: 'pickup_date', label: 'Abholdatum', required: false },
  { key: 'destination_address', label: 'Lieferadresse', required: true },
  { key: 'delivery_date', label: 'Lieferdatum', required: false },
  { key: 'price', label: 'Preis', required: false },
  { key: 'description', label: 'Beschreibung', required: false },
];

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase.functions.invoke('get-customers');
  if (error) throw new Error(error.message);
  return data.customers;
};

const OrderImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>();
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
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
          setMapping({}); // Reset mapping on new file
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleMappingChange = (systemField: string, excelHeader: string) => {
    setMapping(prev => ({ ...prev, [systemField]: excelHeader }));
  };

  const previewData = useMemo(() => {
    if (rows.length === 0 || Object.keys(mapping).length === 0) return [];
    
    const headerIndexMap: Record<string, number> = {};
    headers.forEach((h, i) => { headerIndexMap[h] = i; });

    return rows.map(row => {
      const rowData: Record<string, any> = {};
      IMPORT_FIELDS.forEach(field => {
        const excelHeader = mapping[field.key];
        if (excelHeader) {
          const index = headerIndexMap[excelHeader];
          let value = row[index];
          if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
          }
          rowData[field.key] = value;
        }
      });
      return rowData;
    }).filter(row => Object.values(row).some(val => val !== undefined && val !== null && val !== ''));
  }, [rows, headers, mapping]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId || previewData.length === 0) {
        throw new Error("Bitte wählen Sie einen Kunden aus und stellen Sie sicher, dass Daten zur Vorschau vorhanden sind.");
      }
      const { data, error } = await supabase.functions.invoke('batch-import-orders', {
        body: {
          customerId: selectedCustomerId,
          orders: previewData,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess(`${data.successCount} von ${data.totalCount} Aufträgen erfolgreich importiert!`);
      if (data.errorCount > 0) {
        showError(`${data.errorCount} Aufträge konnten nicht importiert werden. Details in der Konsole.`);
        console.error("Importfehler:", data.errors);
      }
      setFile(null);
      setHeaders([]);
      setRows([]);
      setMapping({});
    },
    onError: (err: any) => {
      showError(err.data?.error || err.message || "Ein unerwarteter Fehler ist aufgetreten.");
    }
  });

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
                <Form.Label>XLSX-Datei hochladen</Form.Label>
                <Form.Control type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
              </Form.Group>
              {file && (
                <Form.Group>
                  <Form.Label>Kunde für diesen Import</Form.Label>
                  <CustomerCombobox
                    customers={customers || []}
                    value={selectedCustomerId}
                    onChange={(val) => setSelectedCustomerId(val)}
                    onAddNew={() => setIsAddCustomerDialogOpen(true)}
                  />
                </Form.Group>
              )}
            </Card.Body>
          </Card>
          {headers.length > 0 && (
            <Card>
              <Card.Header><Card.Title as="h6">2. Spalten zuordnen</Card.Title></Card.Header>
              <Card.Body>
                <p className="small text-muted">Ordnen Sie die Spalten Ihrer Excel-Datei den Systemfeldern zu.</p>
                {IMPORT_FIELDS.map(field => (
                  <Form.Group as={Row} className="mb-2 align-items-center" key={field.key}>
                    <Form.Label column sm="5">
                      {field.label} {field.required && <span className="text-danger">*</span>}
                    </Form.Label>
                    <Col sm="7">
                      <Form.Select
                        value={mapping[field.key] || ''}
                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      >
                        <option value="">Spalte auswählen...</option>
                        {headers.map(header => <option key={header} value={header}>{header}</option>)}
                      </Form.Select>
                    </Col>
                  </Form.Group>
                ))}
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col lg={7}>
          <Card>
            <Card.Header><Card.Title as="h6">3. Vorschau & Import</Card.Title></Card.Header>
            <Card.Body>
              {!isMappingComplete || !selectedCustomerId ? (
                <div className="text-center text-muted py-5">
                  <p>Bitte laden Sie eine Datei hoch, wählen Sie einen Kunden und ordnen Sie alle Pflichtfelder (*) zu, um eine Vorschau zu sehen.</p>
                </div>
              ) : (
                <>
                  <Alert variant="info">
                    Es werden <strong>{previewData.length}</strong> Aufträge für den Kunden <strong>{customers?.find(c => c.id === selectedCustomerId)?.company_name}</strong> importiert.
                  </Alert>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          {IMPORT_FIELDS.map(field => <th key={field.key}>{field.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 10).map((row, index) => (
                          <tr key={index}>
                            {IMPORT_FIELDS.map(field => <td key={field.key}>{String(row[field.key] ?? '')}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  {previewData.length > 10 && <p className="small text-muted text-center">... und {previewData.length - 10} weitere Zeilen.</p>}
                  <div className="d-grid mt-3">
                    <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
                      {importMutation.isPending ? <Spinner size="sm" /> : `Import starten`}
                    </Button>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <AddCustomerDialog
        show={isAddCustomerDialogOpen}
        onHide={() => setIsAddCustomerDialogOpen(false)}
        onCustomerCreated={(newCustomer) => {
          setSelectedCustomerId(newCustomer.id);
          setIsAddCustomerDialogOpen(false);
        }}
      />
    </>
  );
};

export default OrderImport;