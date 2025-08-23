import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Table, Form, Spinner, Row, Col, ListGroup, Badge } from 'react-bootstrap';
import { Upload, File as FileIcon, Folder, Edit, Trash2, Download, Mail, History } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import Select from 'react-select';
import { ReassignFileDialog } from '@/components/file-manager/ReassignFileDialog';
import { SendFileDialog } from '@/components/file-manager/SendFileDialog';
import { FileHistoryModal } from '@/components/file-manager/FileHistoryModal';
import type { OrderFileWithDetails } from '@/types/files';
import TablePlaceholder from '@/components/TablePlaceholder';

const fetchFiles = async (): Promise<OrderFileWithDetails[]> => {
  const { data, error } = await supabase.functions.invoke('get-all-order-files');
  if (error) throw error;
  return data.files;
};

const fetchOrders = async () => {
  const { data, error } = await supabase.functions.invoke('get-all-order-numbers');
  if (error) throw error;
  return data.orders;
};

const FileManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedOrderIdForUpload, setSelectedOrderIdForUpload] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileToReassign, setFileToReassign] = useState<OrderFileWithDetails | null>(null);
  const [fileToSend, setFileToSend] = useState<OrderFileWithDetails | null>(null);
  const [fileToShowHistory, setFileToShowHistory] = useState<OrderFileWithDetails | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [draggedOverOrderId, setDraggedOverOrderId] = useState<number | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery({ queryKey: ['allOrderFiles'], queryFn: fetchFiles });
  const { data: orders, isLoading: isLoadingOrders } = useQuery({ queryKey: ['allOrderNumbers'], queryFn: fetchOrders });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const { error } = await supabase.functions.invoke('delete-order-file', { body: { fileId } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Datei gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['allOrderFiles'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen."),
  });

  const handleFileUpload = async (file: File, orderId: number) => {
    if (!file || !orderId || !user) {
      showError("Datei oder Auftrag ungültig.");
      return;
    }
    setUploading(true);
    try {
      const filePath = `${orderId}/${uuidv4()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('order-files').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: newFile, error: dbError } = await supabase.from('order_files').insert({
        order_id: orderId,
        user_id: user.id,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
      }).select().single();
      if (dbError) throw dbError;

      await supabase.from('file_activity_logs').insert({
        file_id: newFile.id,
        user_id: user.id,
        action: 'created',
        details: { original_filename: file.name }
      });

      const orderNumber = ordersWithFiles.get(orderId)?.order_number || '';
      showSuccess(`Datei "${file.name}" erfolgreich in Auftrag ${orderNumber} hochgeladen!`);
      queryClient.invalidateQueries({ queryKey: ['allOrderFiles'] });
    } catch (err: any) {
      showError(err.message || "Fehler beim Hochladen.");
    } finally {
      setUploading(false);
    }
  };

  const handleManualUpload = () => {
    if (selectedFile && selectedOrderIdForUpload) {
      handleFileUpload(selectedFile, selectedOrderIdForUpload);
      setSelectedFile(null);
      setSelectedOrderIdForUpload(null);
    } else {
      showError("Bitte wählen Sie eine Datei und einen Auftrag aus.");
    }
  };

  const handleDownload = async (file: OrderFileWithDetails) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-download-url', {
        body: { fileId: file.id, filePath: file.file_path },
      });
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      showError(err.data?.error || "Fehler beim Herunterladen.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDragEnter = (e: React.DragEvent, orderId: number) => { e.preventDefault(); setDraggedOverOrderId(orderId); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDraggedOverOrderId(null); };
  const handleDrop = (e: React.DragEvent, orderId: number) => {
    e.preventDefault();
    setDraggedOverOrderId(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0], orderId);
      e.dataTransfer.clearData();
    }
  };

  const ordersWithFiles = useMemo(() => {
    if (!files) return new Map<number, { order_number: string, files: OrderFileWithDetails[] }>();
    return files.reduce((acc, file) => {
      if (!acc.has(file.order_id)) {
        acc.set(file.order_id, { order_number: file.order_number, files: [] });
      }
      acc.get(file.order_id)!.files.push(file);
      return acc;
    }, new Map<number, { order_number: string, files: OrderFileWithDetails[] }>());
  }, [files]);

  const filteredOrders = useMemo(() => {
    const orderEntries = Array.from(ordersWithFiles.entries());
    if (!searchTerm) return orderEntries;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return orderEntries.filter(([, data]) =>
      data.order_number.toLowerCase().includes(lowerCaseSearch)
    );
  }, [ordersWithFiles, searchTerm]);

  const selectedFiles = useMemo(() => {
    if (!selectedOrderId) return [];
    return ordersWithFiles.get(selectedOrderId)?.files || [];
  }, [selectedOrderId, ordersWithFiles]);

  const orderOptions = orders?.map((o: { id: number, order_number: string }) => ({
    value: o.id,
    label: o.order_number,
  })) || [];

  return (
    <>
      <h1 className="h2 mb-4">Dateimanager</h1>
      <Card className="mb-4">
        <Card.Header><Card.Title className="d-flex align-items-center"><Upload className="me-2" />Neue Datei hochladen</Card.Title></Card.Header>
        <Card.Body>
          <div className="row g-3 align-items-end">
            <div className="col-md-5"><Form.Group><Form.Label>Datei auswählen</Form.Label><Form.Control type="file" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedFile(e.target.files?.[0] || null)} /></Form.Group></div>
            <div className="col-md-5"><Form.Group><Form.Label>Auftrag zuordnen</Form.Label><Select options={orderOptions} isLoading={isLoadingOrders} onChange={(opt) => setSelectedOrderIdForUpload(opt?.value || null)} placeholder="Auftrag auswählen..." isClearable /></Form.Group></div>
            <div className="col-md-2"><Button onClick={handleManualUpload} disabled={uploading || !selectedFile || !selectedOrderIdForUpload} className="w-100">{uploading ? <Spinner size="sm" /> : 'Hochladen'}</Button></div>
          </div>
        </Card.Body>
      </Card>

      <Row>
        <Col md={4}>
          <Card>
            <Card.Header>
              <Card.Title>Auftragsordner</Card.Title>
              <Form.Control placeholder="Ordner suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} size="sm" />
            </Card.Header>
            <ListGroup variant="flush" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {isLoading ? <div className="p-3 text-center"><Spinner size="sm" /></div> : (
                filteredOrders.map(([orderId, data]) => (
                  <ListGroup.Item 
                    key={orderId} 
                    action 
                    active={orderId === selectedOrderId} 
                    onClick={() => setSelectedOrderId(orderId)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, orderId)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, orderId)}
                    style={{
                        transition: 'background-color 0.2s ease-in-out',
                        backgroundColor: draggedOverOrderId === orderId ? '#cfe2ff' : '',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        <Folder size={16} className="me-2" />
                        <span className="fw-medium">{data.order_number}</span>
                      </div>
                      <Badge pill bg="secondary">{data.files.length}</Badge>
                    </div>
                  </ListGroup.Item>
                ))
              )}
            </ListGroup>
          </Card>
        </Col>
        <Col md={8}>
          <Card>
            <Card.Header>
              <Card.Title>
                {selectedOrderId ? `Dateien für Auftrag ${ordersWithFiles.get(selectedOrderId)?.order_number}` : 'Dateien'}
              </Card.Title>
            </Card.Header>
            <Card.Body>
              {isLoading ? <TablePlaceholder /> : !selectedOrderId ? (
                <div className="text-center text-muted py-5">Bitte wählen Sie links einen Ordner aus.</div>
              ) : (
                <Table responsive hover>
                  <thead><tr><th>Dateiname</th><th>Hochgeladen von</th><th>Datum</th><th className="text-end">Aktionen</th></tr></thead>
                  <tbody>
                    {selectedFiles.map(file => (
                      <tr key={file.id}>
                        <td className="fw-medium"><FileIcon size={16} className="me-2" />{file.file_name}</td>
                        <td>{`${file.first_name || ''} ${file.last_name || ''}`.trim()}</td>
                        <td>{new Date(file.created_at).toLocaleString('de-DE')}</td>
                        <td className="text-end">
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(file)} title="Herunterladen"><Download size={16} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setFileToSend(file)} title="Senden"><Mail size={16} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setFileToReassign(file)} title="Neu zuordnen"><Edit size={16} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setFileToShowHistory(file)} title="Historie"><History size={16} /></Button>
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => deleteMutation.mutate(file.id)} title="Löschen"><Trash2 size={16} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <ReassignFileDialog show={!!fileToReassign} onHide={() => setFileToReassign(null)} file={fileToReassign} />
      <SendFileDialog show={!!fileToSend} onHide={() => setFileToSend(null)} file={fileToSend} />
      <FileHistoryModal show={!!fileToShowHistory} onHide={() => setFileToShowHistory(null)} file={fileToShowHistory} />
    </>
  );
};

export default FileManager;