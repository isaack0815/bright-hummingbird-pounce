import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Table, Form, Spinner, Row, Col, Breadcrumb, Modal, InputGroup, Tabs, Tab } from 'react-bootstrap';
import { Folder, File as FileIcon, Upload, Plus, Trash2, Download, Share2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import type { UserFolder, UserFile } from '@/types/personal-files';
import { ShareFileDialog } from './ShareFileDialog';

type EnrichedUserFile = UserFile & {
    profiles?: { first_name: string | null, last_name: string | null } | null;
};

const fetchFilesAndFolders = async (): Promise<{ folders: UserFolder[], ownedFiles: UserFile[], sharedFiles: EnrichedUserFile[] }> => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action: 'get-user-files-and-folders' }
  });
  if (error) throw error;
  return data;
};

export const PersonalFilesBrowser = () => {
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileToShare, setFileToShare] = useState<UserFile | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['myFiles'],
    queryFn: fetchFilesAndFolders,
  });

  const { folders, ownedFiles, sharedFiles } = data || { folders: [], ownedFiles: [], sharedFiles: [] };

  const { currentItems, breadcrumbs } = useMemo(() => {
    const currentFiles = ownedFiles.filter(f => f.folder_id === currentFolderId);
    const currentFolders = folders.filter(f => f.parent_folder_id === currentFolderId);
    
    const breadcrumbs: UserFolder[] = [];
    let parentId = currentFolderId;
    while (parentId) {
      const parent = folders.find(f => f.id === parentId);
      if (parent) {
        breadcrumbs.unshift(parent);
        parentId = parent.parent_folder_id;
      } else {
        parentId = null;
      }
    }
    return { currentItems: [...currentFolders, ...currentFiles], breadcrumbs };
  }, [currentFolderId, folders, ownedFiles]);

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('action', {
        body: { action: 'create-user-folder', payload: { name: newFolderName, parent_folder_id: currentFolderId } }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Ordner erstellt!");
      queryClient.invalidateQueries({ queryKey: ['myFiles'] });
      setShowNewFolderModal(false);
      setNewFolderName('');
    },
    onError: (err: any) => showError(err.message),
  });

  const uploadFileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !user) throw new Error("Datei oder Benutzer nicht gefunden");
      const filePath = `${user.id}/${currentFolderId || 'root'}/${uuidv4()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from('user-files').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('user_files').insert({
        user_id: user.id,
        folder_id: currentFolderId,
        file_name: selectedFile.name,
        file_path: filePath,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      showSuccess("Datei hochgeladen!");
      queryClient.invalidateQueries({ queryKey: ['myFiles'] });
      setSelectedFile(null);
    },
    onError: (err: any) => showError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: UserFolder | UserFile) => {
      const isFolder = 'parent_folder_id' in item;
      if (isFolder) {
        const hasContent = ownedFiles.some(f => f.folder_id === item.id) || folders.some(f => f.parent_folder_id === item.id);
        if (hasContent) throw new Error("Ordner muss leer sein, um gelöscht zu werden.");
        await supabase.functions.invoke('action', { body: { action: 'delete-user-folder', payload: { folderId: item.id } } });
      } else {
        await supabase.functions.invoke('action', { body: { action: 'delete-user-file', payload: { fileId: item.id } } });
      }
    },
    onSuccess: () => {
      showSuccess("Element gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['myFiles'] });
    },
    onError: (err: any) => showError(err.message),
  });

  const handleDownload = async (file: UserFile) => {
    const { data, error } = await supabase.functions.invoke('action', {
      body: { action: 'get-user-file-download-url', payload: { filePath: file.file_path } }
    });
    if (error) { showError(error.message); return; }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <>
      <Tabs defaultActiveKey="my-files" className="mb-3">
        <Tab eventKey="my-files" title="Meine Dateien">
          <Card>
            <Card.Header>
              <Row className="align-items-center">
                <Col>
                  <Breadcrumb listProps={{ className: "mb-0" }}>
                    <Breadcrumb.Item onClick={() => setCurrentFolderId(null)} active={currentFolderId === null}>Home</Breadcrumb.Item>
                    {breadcrumbs.map(b => <Breadcrumb.Item key={b.id} onClick={() => setCurrentFolderId(b.id)} active={b.id === currentFolderId}>{b.name}</Breadcrumb.Item>)}
                  </Breadcrumb>
                </Col>
                <Col xs="auto">
                  <Button variant="outline-secondary" size="sm" onClick={() => setShowNewFolderModal(true)}><Plus className="me-1" size={16} /> Neuer Ordner</Button>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body>
              <InputGroup className="mb-3">
                <Form.Control type="file" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedFile(e.target.files?.[0] || null)} />
                <Button onClick={() => uploadFileMutation.mutate()} disabled={!selectedFile || uploadFileMutation.isPending}>
                  {uploadFileMutation.isPending ? <Spinner size="sm" /> : <><Upload size={16} className="me-2" /> Hochladen</>}
                </Button>
              </InputGroup>
              <Table hover>
                <thead><tr><th>Name</th><th>Typ</th><th>Datum</th><th className="text-end">Aktionen</th></tr></thead>
                <tbody>
                  {isLoading && <tr><td colSpan={4} className="text-center"><Spinner /></td></tr>}
                  {currentItems.map(item => {
                    const isFolder = 'parent_folder_id' in item;
                    return (
                      <tr key={`${isFolder ? 'f' : 'i'}-${item.id}`} onDoubleClick={() => isFolder && setCurrentFolderId(item.id)} style={{ cursor: isFolder ? 'pointer' : 'default' }}>
                        <td>{isFolder ? <Folder size={16} className="me-2" /> : <FileIcon size={16} className="me-2" />}{isFolder ? item.name : item.file_name}</td>
                        <td>{isFolder ? 'Ordner' : item.file_type}</td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td className="text-end">
                          {!isFolder && <Button variant="ghost" size="sm" onClick={() => handleDownload(item)}><Download size={16} /></Button>}
                          {!isFolder && <Button variant="ghost" size="sm" onClick={() => setFileToShare(item)}><Share2 size={16} /></Button>}
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => deleteMutation.mutate(item)}><Trash2 size={16} /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="shared-with-me" title="Für mich freigegeben">
          <Card>
            <Card.Body>
              <Table hover>
                <thead><tr><th>Name</th><th>Typ</th><th>Freigegeben von</th><th className="text-end">Aktionen</th></tr></thead>
                <tbody>
                  {isLoading && <tr><td colSpan={4} className="text-center"><Spinner /></td></tr>}
                  {sharedFiles.map(file => (
                    <tr key={file.id}>
                      <td><FileIcon size={16} className="me-2" />{file.file_name}</td>
                      <td>{file.file_type}</td>
                      <td>{`${file.profiles?.first_name || ''} ${file.profiles?.last_name || ''}`.trim()}</td>
                      <td className="text-end">
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(file)}><Download size={16} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      <Modal show={showNewFolderModal} onHide={() => setShowNewFolderModal(false)}>
        <Modal.Header closeButton><Modal.Title>Neuer Ordner</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Control placeholder="Name des Ordners" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNewFolderModal(false)}>Abbrechen</Button>
          <Button onClick={() => createFolderMutation.mutate()} disabled={!newFolderName || createFolderMutation.isPending}>
            {createFolderMutation.isPending ? <Spinner size="sm" /> : "Erstellen"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ShareFileDialog show={!!fileToShare} onHide={() => setFileToShare(null)} file={fileToShare} />
    </>
  );
};