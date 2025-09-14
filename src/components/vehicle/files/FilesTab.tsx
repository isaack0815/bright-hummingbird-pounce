import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, Form, Button, Placeholder, Accordion, Spinner } from "react-bootstrap";
import { showError, showSuccess } from "@/utils/toast";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from 'uuid';
import type { VehicleFile } from "@/types/vehicle";
import { FileCategoryCombobox } from "./FileCategoryCombobox";
import { FileListItem } from "./FileListItem";

const fetchFiles = async (vehicleId: number): Promise<VehicleFile[]> => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action: 'get-vehicle-files', payload: { vehicleId } }
  });
  if (error) throw error;
  return data.files;
};

const FilesTab = ({ vehicleId }: { vehicleId: number | null }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery({
    queryKey: ['vehicleFiles', vehicleId],
    queryFn: () => fetchFiles(vehicleId!),
    enabled: !!vehicleId,
  });

  const handleFileUpload = async () => {
    if (!selectedFile || !vehicleId || !user || !selectedCategoryId) {
      showError("Bitte wählen Sie eine Datei und eine Kategorie aus.");
      return;
    }
    setUploading(true);
    try {
      const filePath = `${vehicleId}/${uuidv4()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from('vehicle-files').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      await supabase.from('vehicle_files').insert({
        vehicle_id: vehicleId,
        category_id: selectedCategoryId,
        user_id: user.id,
        file_path: filePath,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
      });

      queryClient.invalidateQueries({ queryKey: ['vehicleFiles', vehicleId] });
      showSuccess("Datei erfolgreich hochgeladen!");
      setSelectedFile(null);
      setSelectedCategoryId(undefined);
    } catch (err: any) {
      showError(err.message || "Fehler beim Hochladen der Datei.");
    } finally {
      setUploading(false);
    }
  };

  const filesByCategory = useMemo(() => {
    if (!files) return {};
    return files.reduce((acc, file) => {
      const category = file.category_name || 'Unkategorisiert';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(file);
      return acc;
    }, {} as Record<string, VehicleFile[]>);
  }, [files]);

  if (!vehicleId) return null;

  return (
    <Card>
      <Card.Header><Card.Title>Fahrzeugakte</Card.Title></Card.Header>
      <Card.Body>
        <div className="border p-3 rounded mb-4">
          <h6 className="mb-3">Neue Datei hochladen</h6>
          <div className="row g-3 align-items-end">
            <div className="col-md-5"><Form.Group><Form.Label>Datei</Form.Label><Form.Control type="file" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedFile(e.target.files?.[0] || null)} /></Form.Group></div>
            <div className="col-md-5"><Form.Group><Form.Label>Kategorie</Form.Label><FileCategoryCombobox value={selectedCategoryId} onChange={setSelectedCategoryId} /></Form.Group></div>
            <div className="col-md-2"><Button onClick={handleFileUpload} disabled={uploading || !selectedFile || !selectedCategoryId} className="w-100">{uploading ? <Spinner size="sm" /> : 'Hochladen'}</Button></div>
          </div>
        </div>
        
        {isLoading && <Placeholder animation="glow"><Placeholder xs={12} style={{ height: '150px' }} /></Placeholder>}
        
        {!isLoading && Object.keys(filesByCategory).length > 0 ? (
          <Accordion defaultActiveKey={Object.keys(filesByCategory)[0]} alwaysOpen>
            {Object.entries(filesByCategory).map(([category, files]) => (
              <Accordion.Item eventKey={category} key={category}>
                <Accordion.Header>{category} ({files.length})</Accordion.Header>
                <Accordion.Body className="d-flex flex-column gap-2">
                  {files.map(file => <FileListItem key={file.id} file={file} />)}
                </Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        ) : !isLoading && <p className="text-muted text-center">Keine Dateien vorhanden.</p>}
      </Card.Body>
    </Card>
  );
};

export default FilesTab;