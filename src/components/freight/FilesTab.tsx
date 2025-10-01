import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, Form, Placeholder } from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/toast";
import { FileListItem } from "./FileListItem";

type OrderFile = {
  id: number;
  file_name: string;
  file_path: string;
  file_type: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  is_archived: boolean;
};

const fetchFiles = async (orderId: number): Promise<OrderFile[]> => {
  const { data, error } = await supabase
    .from('order_files_with_profile')
    .select('*')
    .eq('order_id', orderId)
    .eq('is_archived', false) // Only fetch non-archived files
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const FilesTab = ({ orderId }: { orderId: number | null }) => {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery({
    queryKey: ['orderFiles', orderId],
    queryFn: () => fetchFiles(orderId!),
    enabled: !!orderId,
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !orderId || !user) return;

    setUploading(true);
    try {
      const fileData = await fileToBase64(file);
      
      const { error } = await supabase.functions.invoke('action', {
        body: {
          action: 'upload-order-file',
          payload: {
            orderId,
            fileName: file.name,
            fileType: file.type,
            fileData,
          }
        }
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['orderFiles', orderId] });
      showSuccess("Datei erfolgreich hochgeladen!");
    } catch (err: any) {
      showError(err.data?.error || err.message || "Fehler beim Hochladen der Datei.");
    } finally {
      setUploading(false);
      event.target.value = ''; // Reset file input
    }
  };

  if (!orderId) {
    return (
      <Card>
        <Card.Header><Card.Title>Dateien</Card.Title></Card.Header>
        <Card.Body><p className="text-muted">Bitte speichern Sie den Auftrag zuerst, um Dateien hochzuladen.</p></Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header><Card.Title>Dateien</Card.Title></Card.Header>
      <Card.Body className="d-flex flex-column gap-4">
        <div>
          <Form.Control type="file" onChange={handleFileUpload} disabled={uploading} />
          {uploading && <p className="small text-muted mt-2">Wird hochgeladen...</p>}
        </div>
        <div className="d-flex flex-column gap-2">
          {isLoading && <Placeholder animation="glow"><Placeholder xs={12} style={{ height: '50px' }} /></Placeholder>}
          {files?.map(file => (
            <FileListItem key={file.id} file={file} orderId={orderId} />
          ))}
          {!isLoading && files?.length === 0 && <p className="text-muted text-center">Keine Dateien vorhanden.</p>}
        </div>
      </Card.Body>
    </Card>
  );
};

export default FilesTab;