import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Table, Form, Spinner, Row, Col, ListGroup, Badge, Tabs, Tab } from 'react-bootstrap';
import { Upload, File as FileIcon, Folder, Edit, Trash2, Download, Mail, History, Truck } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import Select from 'react-select';
import { ReassignFileDialog } from '@/components/file-manager/ReassignFileDialog';
import { SendFileDialog } from '@/components/file-manager/SendFileDialog';
import { FileHistoryModal } from '@/components/file-manager/FileHistoryModal';
import type { OrderFileWithDetails, VehicleFileWithDetails } from '@/types/files';
import TablePlaceholder from '@/components/TablePlaceholder';

const fetchAllFiles = async (): Promise<{ orderFiles: OrderFileWithDetails[], vehicleFiles: VehicleFileWithDetails[] }> => {
  const [orderFilesRes, vehicleFilesRes] = await Promise.all([
    supabase.functions.invoke('get-all-order-files'),
    supabase.functions.invoke('action', { body: { action: 'get-all-vehicle-files' } })
  ]);
  if (orderFilesRes.error) throw orderFilesRes.error;
  if (vehicleFilesRes.error) throw vehicleFilesRes.error;
  return { orderFiles: orderFilesRes.data.files, vehicleFiles: vehicleFilesRes.data.files };
};

const fetchParentEntities = async () => {
  const [ordersRes, vehiclesRes] = await Promise.all([
    supabase.functions.invoke('get-all-order-numbers'),
    supabase.functions.invoke('action', { body: { action: 'get-all-vehicles-for-select' } })
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (vehiclesRes.error) throw vehiclesRes.error;
  return { orders: ordersRes.data.orders, vehicles: vehiclesRes.data.vehicles };
};

const FileManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: 'order' | 'vehicle', id: number | null }>({ type: 'order', id: null });
  const [uploading, setUploading] = useState(false);
  const [fileToReassign, setFileToReassign] = useState<OrderFileWithDetails | null>(null);
  const [fileToSend, setFileToSend] = useState<OrderFileWithDetails | null>(null);
  const [fileToShowHistory, setFileToShowHistory] = useState<OrderFileWithDetails | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ type: 'order' | 'vehicle', id: number } | null>(null);
  const [draggedOverFolder, setDraggedOverFolder] = useState<{ type: 'order' | 'vehicle', id: number } | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: allFiles, isLoading } = useQuery({ queryKey: ['allFiles'], queryFn: fetchAllFiles });
  const { data: parentEntities, isLoading: isLoadingParents } = useQuery({ queryKey: ['parentEntities'], queryFn: fetchParentEntities });

  const deleteMutation = useMutation({
    mutationFn: async (file: OrderFileWithDetails | VehicleFileWithDetails) => {
      const isOrderFile = 'order_id' in file;
      const functionName = isOrderFile ? 'delete-order-file' : 'action';
      const payload = isOrderFile ? { fileId: file.id } : { action: 'delete-vehicle-file', payload: { fileId: file.id } };
      const { error } = await supabase.functions.invoke(functionName, { body: payload });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Datei gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['allFiles'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen."),
  });

  const handleFileUpload = async (file: File, target: { type: 'order' | 'vehicle', id: number }) => {
    if (!file || !target.id || !user) return;
    setUploading(true);
    try {
      const storageBucket = target.type === 'order' ? 'order-files' : 'vehicle-files';
      const tableName = target.type === 'order' ? 'order_files' : 'vehicle_files';
      const idColumn = target.type === 'order' ? 'order_id' : 'vehicle_id';

      const filePath = `${target.id}/${uuidv4()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(storageBucket).upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: newFile, error: dbError } = await supabase.from(tableName).insert({
        [idColumn]: target.id,
        user_id: user.id,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
      }).select('id').single();
      if (dbError) throw dbError;

      if (target.type === 'order') {
        await supabase.from('file_activity_logs').insert({ file_id: newFile.id, user_id: user.id, action: 'created', details: { original_filename: file.name } });
      }

      showSuccess(`Datei erfolgreich hochgeladen!`);
      queryClient.invalidateQueries({ queryKey: ['allFiles'] });
    } catch (err: any) {
      showError(err.message || "Fehler beim Hochladen.");
    } finally {
      setUploading(false);
    }
  };

  const handleManualUpload = () => {
    if (selectedFile && uploadTarget.id) {
      handleFileUpload(selectedFile, { type: uploadTarget.type, id: uploadTarget.id });
      setSelectedFile(null);
      setUploadTarget({ type: 'order', id: null });
    } else {
      showError("Bitte wählen Sie eine Datei und ein Ziel aus.");
    }
  };

  const handleDownload = async (file: OrderFileWithDetails | VehicleFileWithDetails) => {
    const isOrderFile = 'order_id' in file;
    const functionName = isOrderFile ? 'get-download-url' : 'action';
    const payload = isOrderFile 
        ? { fileId: file.id, filePath: file.file_path } 
        : { action: 'get-vehicle-file-download-url', payload: { filePath: file.file_path } };
    
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body: payload });
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      showError(err.data?.error || "Fehler beim Herunterladen.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDragEnter = (e: React.DragEvent, folder: { type: 'order' | 'vehicle', id: number }) => { e.preventDefault(); setDraggedOverFolder(folder); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDraggedOverFolder(null); };
  const handleDrop = (e: React.DragEvent, folder: { type: 'order' | 'vehicle', id: number }) => {
    e.preventDefault();
    setDraggedOverFolder(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0], folder);
      e.dataTransfer.clearData();
    }
  };

  const { orderFolders, vehicleFolders } = useMemo(() => {
    const orderFolders = new Map<number, { name: string, files: OrderFileWithDetails[] }>();
    allFiles?.orderFiles.forEach(file => {
      if (!orderFolders.has(file.order_id)) orderFolders.set(file.order_id, { name: file.order_number, files: [] });
      orderFolders.get(file.order_id)!.files.push(file);
    });

    const vehicleFolders = new Map<number, { name: string, files: VehicleFileWithDetails[] }>();
    allFiles?.vehicleFiles.forEach(file => {
      if (!vehicleFolders.has(file.vehicle_id)) vehicleFolders.set(file.vehicle_id, { name: file.license_plate, files: [] });
      vehicleFolders.get(file.vehicle_id)!.files.push(file);
    });

    return { orderFolders, vehicleFolders };
  }, [allFiles]);

  const filteredOrderFolders = useMemo(() => {
    const orderEntries = Array.from(orderFolders.entries());
    if (!searchTerm) return orderEntries;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return orderEntries.filter(([, data]) =>
      (data.name || '').toLowerCase().includes(lowerCaseSearch)
    );
  }, [orderFolders, searchTerm]);

  const filteredVehicleFolders = useMemo(() => {
    const vehicleEntries = Array.from(vehicleFolders.entries());
    if (!searchTerm) return vehicleEntries;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return vehicleEntries.filter(([, data]) =>
      (data.name || '').toLowerCase().includes(lowerCaseSearch)
    );
  }, [vehicleFolders, searchTerm]);

  const selectedFiles = useMemo(() => {
    if (!selectedFolder) return [];
    if (selectedFolder.type === 'order') return orderFolders.get(selectedFolder.id)?.files || [];
    return vehicleFolders.get(selectedFolder.id)?.files || [];
  }, [selectedFolder, orderFolders, vehicleFolders]);

  const orderOptions = parentEntities?.orders.map((o: any) => ({ value: o.id, label: o.order_number })) || [];
  const vehicleOptions = parentEntities?.vehicles.map((v: any) => ({ value: v.id, label: v.license_plate })) || [];

  return (
    <>
      <h1 className="h2 mb-4">Dateimanager</h1>
      <Card className="mb-4">
        <Card.Header><Card.Title className="d-flex align-items-center"><Upload className="me-2" />Neue Datei hochladen</Card.Title></Card.Header>
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={4}><Form.Group><Form.Label>Datei</Form.Label><Form.Control type="file" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedFile(e.target.files?.[0] || null)} /></Form.Group></Col>
            <Col md={2}><Form.Group><Form.Label>Zieltyp</Form.Label><Form.Select value={uploadTarget.type} onChange={e => setUploadTarget({ type: e.target.value as any, id: null })}><option value="order">Auftrag</option><option value="vehicle">Fahrzeug</option></Form.Select></Form.Group></Col>
            <Col md={4}><Form.Group><Form.Label>Ziel</Form.Label><Select options={uploadTarget.type === 'order' ? orderOptions : vehicleOptions} isLoading={isLoadingParents} onChange={(opt: any) => setUploadTarget(prev => ({ ...prev, id: opt?.value || null }))} placeholder="Ziel auswählen..." isClearable /></Form.Group></Col>
            <Col md={2}><Button onClick={handleManualUpload} disabled={uploading || !selectedFile || !uploadTarget.id} className="w-100">{uploading ? <Spinner size="sm" /> : 'Hochladen'}</Button></Col>
          </Row>
        </Card.Body>
      </Card>

      <Row>
        <Col md={4}>
          <Card>
            <Card.Header>
              <Card.Title>Ordner</Card.Title>
              <Form.Control placeholder="Suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} size="sm" />
            </Card.Header>
            <Tabs defaultActiveKey="orders" fill>
              <Tab eventKey="orders" title="Aufträge">
                <ListGroup variant="flush" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  {isLoading ? <div className="p-3 text-center"><Spinner size="sm" /></div> : filteredOrderFolders.map(([id, data]) => (
                    <ListGroup.Item key={`order-${id}`} action active={selectedFolder?.id === id && selectedFolder.type === 'order'} onClick={() => setSelectedFolder({ type: 'order', id })} onDragOver={handleDragOver} onDragEnter={(e) => handleDragEnter(e, { type: 'order', id })} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, { type: 'order', id })} style={{ backgroundColor: draggedOverFolder?.id === id && draggedOverFolder.type === 'order' ? '#cfe2ff' : '' }}>
                      <div className="d-flex justify-content-between align-items-center"><div className="d-flex align-items-center"><Folder size={16} className="me-2" /><span className="fw-medium">{data.name}</span></div><Badge pill bg="secondary">{data.files.length}</Badge></div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Tab>
              <Tab eventKey="vehicles" title="Fahrzeuge">
                <ListGroup variant="flush" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  {isLoading ? <div className="p-3 text-center"><Spinner size="sm" /></div> : filteredVehicleFolders.map(([id, data]) => (
                    <ListGroup.Item key={`vehicle-${id}`} action active={selectedFolder?.id === id && selectedFolder.type === 'vehicle'} onClick={() => setSelectedFolder({ type: 'vehicle', id })} onDragOver={handleDragOver} onDragEnter={(e) => handleDragEnter(e, { type: 'vehicle', id })} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, { type: 'vehicle', id })} style={{ backgroundColor: draggedOverFolder?.id === id && draggedOverFolder.type === 'vehicle' ? '#cfe2ff' : '' }}>
                      <div className="d-flex justify-content-between align-items-center"><div className="d-flex align-items-center"><Truck size={16} className="me-2" /><span className="fw-medium">{data.name}</span></div><Badge pill bg="secondary">{data.files.length}</Badge></div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Tab>
            </Tabs>
          </Card>
        </Col>
        <Col md={8}>
          <Card>
            <Card.Header><Card.Title>{selectedFolder ? `Dateien für ${selectedFolder.type === 'order' ? orderFolders.get(selectedFolder.id)?.name : vehicleFolders.get(selectedFolder.id)?.name}` : 'Dateien'}</Card.Title></Card.Header>
            <Card.Body>
              {isLoading ? <TablePlaceholder /> : !selectedFolder ? <div className="text-center text-muted py-5">Bitte wählen Sie links einen Ordner aus.</div> : (
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
                          {selectedFolder.type === 'order' && <>
                            <Button variant="ghost" size="sm" onClick={() => setFileToSend(file as OrderFileWithDetails)} title="Senden"><Mail size={16} /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setFileToReassign(file as OrderFileWithDetails)} title="Neu zuordnen"><Edit size={16} /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setFileToShowHistory(file as OrderFileWithDetails)} title="Historie"><History size={16} /></Button>
                          </>}
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => deleteMutation.mutate(file)} title="Löschen"><Trash2 size={16} /></Button>
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