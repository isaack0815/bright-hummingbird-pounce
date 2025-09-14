import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Table, Spinner, Breadcrumb } from 'react-bootstrap';
import { Folder, File as FileIcon, Upload, PlusCircle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import type { CloudFolder, CloudFile } from '@/types/cloud';
import { CreateFolderModal } from '@/components/cloud/CreateFolderModal';

const fetchFileStructure = async (): Promise<{ folders: CloudFolder[], files: CloudFile[] }> => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action: 'get-file-structure' }
  });
  if (error) throw new Error(error.message);
  return data;
};

const CloudStorage = () => {
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['fileStructure'],
    queryFn: fetchFileStructure,
  });

  const { folders, files } = data || { folders: [], files: [] };

  const breadcrumbs = useMemo(() => {
    const crumbs = [{ id: null, name: 'Home' }];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (folder) {
        crumbs.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parent_folder_id;
      } else {
        break;
      }
    }
    return crumbs;
  }, [currentFolderId, folders]);

  const currentFolders = useMemo(() => folders.filter(f => f.parent_folder_id === currentFolderId), [folders, currentFolderId]);
  const currentFiles = useMemo(() => files.filter(f => f.folder_id === currentFolderId), [files, currentFolderId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const filePath = `${user.id}/${currentFolderId || 'root'}/${uuidv4()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('cloud_storage').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('files').insert({
        name: file.name,
        folder_id: currentFolderId,
        storage_path: filePath,
        file_type: file.type,
        file_size: file.size,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ['fileStructure'] });
      showSuccess("Datei erfolgreich hochgeladen!");
    } catch (err: any) {
      showError(err.message || "Fehler beim Hochladen.");
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Dateimanager</h1>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={() => document.getElementById('file-upload-input')?.click()} disabled={uploading}>
            <Upload size={16} className="me-2" /> {uploading ? 'Wird hochgeladen...' : 'Datei hochladen'}
          </Button>
          <input type="file" id="file-upload-input" className="d-none" onChange={handleFileUpload} />
          <Button onClick={() => setIsCreateFolderModalOpen(true)}>
            <PlusCircle size={16} className="me-2" /> Neuer Ordner
          </Button>
        </div>
      </div>

      <Card>
        <Card.Header>
          <Breadcrumb listProps={{ className: "mb-0" }}>
            {breadcrumbs.map((crumb, index) => (
              <Breadcrumb.Item key={crumb.id || 'home'} onClick={() => setCurrentFolderId(crumb.id)} active={index === breadcrumbs.length - 1}>
                {crumb.name}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>
        </Card.Header>
        <Card.Body>
          {isLoading ? <div className="text-center"><Spinner /></div> : (
            <Table hover>
              <tbody>
                {currentFolders.map(folder => (
                  <tr key={`folder-${folder.id}`} onDoubleClick={() => setCurrentFolderId(folder.id)} style={{ cursor: 'pointer' }}>
                    <td><Folder size={20} className="me-2" /> {folder.name}</td>
                    <td>Ordner</td>
                    <td>{new Date(folder.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {currentFiles.map(file => (
                  <tr key={`file-${file.id}`}>
                    <td><FileIcon size={20} className="me-2" /> {file.name}</td>
                    <td>{file.file_type}</td>
                    <td>{new Date(file.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!isLoading && currentFolders.length === 0 && currentFiles.length === 0 && (
            <p className="text-muted text-center">Dieser Ordner ist leer.</p>
          )}
        </Card.Body>
      </Card>

      <CreateFolderModal show={isCreateFolderModalOpen} onHide={() => setIsCreateFolderModalOpen(false)} parentFolderId={currentFolderId} />
    </>
  );