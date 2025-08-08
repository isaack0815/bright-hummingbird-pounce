import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Table, Form, Spinner } from 'react-bootstrap';
import { Download, Trash2, Edit, Upload, File as FileIcon } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import Select from 'react-select';
import { ReassignFileDialog } from '@/components/file-manager/ReassignFileDialog';
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
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileToReassign, setFileToReassign] = useState<OrderFileWithDetails | null>(null);
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

  const handleUpload = async () => {
    if (!selectedFile || !selectedOrderId || !user) {
      showError("Bitte wählen Sie eine Datei und einen Auftrag aus.");
      return;
    }
    setUploading(true);
    try {
      const filePath = `${selectedOrderId}/${uuidv4()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from('order-files').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      await supabase.from('order_files').insert({
        order_id: selectedOrderId,
        user_id: user.id,
        file_path: filePath,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
      });
      showSuccess("Datei erfolgreich hochgeladen!");
      queryClient.invalidateQueries({ queryKey: ['allOrderFiles'] });
      setSelectedFile(null);
      setSelectedOrderId(null);
    } catch (err: any) {
      showError(err.message || "Fehler beim Hochladen.");
    } finally {
      setUploading(false);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    return files.filter(file =>
      file.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.order_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [files, searchTerm]);

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
            <div className="col-md-5"><Form.Group><Form.Label>Auftrag zuordnen</Form.Label><Select options={orderOptions} isLoading={isLoadingOrders} onChange={(opt) => setSelectedOrderId(opt?.value || null)} placeholder="Auftrag auswählen..." isClearable /></Form.Group></div>
            <div className="col-md-2"><Button onClick={handleUpload} disabled={uploading || !selectedFile || !selectedOrderId} className="w-100">{uploading ? <Spinner size="sm" /> : 'Hochladen'}</Button></div>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Alle Dateien</Card.Title>
          <Form.Control placeholder="Suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
        </Card.Header>
        <Card.Body>
          {isLoading ? <TablePlaceholder /> : (
            <Table responsive hover>
              <thead><tr><th>Dateiname</th><th>Auftrag</th><th>Hochgeladen von</th><th>Datum</th><th className="text-end">Aktionen</th></tr></thead>
              <tbody>
                {filteredFiles.map(file => (
                  <tr key={file.id}>
                    <td className="fw-medium"><FileIcon size={16} className="me-2" />{file.file_name}</td>
                    <td>{file.order_number}</td>
                    <td>{`${file.first_name || ''} ${file.last_name || ''}`.trim()}</td>
                    <td>{new Date(file.created_at).toLocaleString('de-DE')}</td>
                    <td className="text-end">
                      <Button variant="ghost" size="sm" onClick={() => setFileToReassign(file)}><Edit size={16} /></Button>
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => deleteMutation.mutate(file.id)}><Trash2 size={16} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      <ReassignFileDialog show={!!fileToReassign} onHide={() => setFileToReassign(null)} file={fileToReassign} />
    </>
  );
};

export default FileManager;