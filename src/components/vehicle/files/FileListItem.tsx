import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "react-bootstrap";
import { showError, showSuccess } from "@/utils/toast";
import { File as FileIcon, Trash2, Download, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { VehicleFile } from "@/types/vehicle";

type FileListItemProps = {
  file: VehicleFile;
};

export const FileListItem = ({ file }: FileListItemProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const { error } = await supabase.functions.invoke('action', {
        body: { action: 'delete-vehicle-file', payload: { fileId } }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleFiles', file.vehicle_id] });
      showSuccess("Datei gelöscht!");
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen der Datei."),
  });

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage.from('vehicle-files').createSignedUrl(file.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      showError(err.message || "Fehler beim Herunterladen.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Sind Sie sicher, dass Sie die Datei "${file.file_name}" löschen möchten?`)) {
      deleteMutation.mutate(file.id);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-between rounded border p-3 bg-light">
      <div className="d-flex align-items-center gap-3 overflow-hidden">
        <FileIcon className="h-6 w-6 text-muted flex-shrink-0" />
        <div className="flex-grow-1 overflow-hidden">
          <p className="fw-medium text-truncate mb-0">{file.file_name}</p>
          <p className="small text-muted mb-0">
            Hochgeladen von {`${file.first_name || ''} ${file.last_name || ''}`.trim() || 'Unbekannt'} am {new Date(file.created_at).toLocaleString('de-DE')}
          </p>
        </div>
      </div>
      <div className="d-flex align-items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={handleDownload} disabled={isDownloading || deleteMutation.isPending}>
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={isDownloading || deleteMutation.isPending}>
          {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-danger" />}
        </Button>
      </div>
    </div>
  );
};