import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { File as FileIcon, Trash2, Download, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type OrderFile = {
  id: number;
  file_name: string;
  file_path: string;
  file_type: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
};

type FileListItemProps = {
  file: OrderFile;
  orderId: number;
};

export const FileListItem = ({ file, orderId }: FileListItemProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async ({ id, path }: { id: number, path: string }) => {
      await supabase.storage.from('order-files').remove([path]);
      const { error } = await supabase.from('order_files').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderFiles', orderId] });
      showSuccess("Datei gelöscht!");
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Löschen der Datei.");
    },
    onSettled: () => {
      setIsDeleting(false);
    }
  });

  const handleDownload = async () => {
    if (!file.file_path) {
      showError("Kein Dateipfad für diese Datei vorhanden.");
      return;
    }
    
    setIsDownloading(true);

    try {
      const { data, error } = await supabase.functions.invoke('get-download-url', {
        body: { filePath: file.file_path },
      });

      if (error) throw error;
      
      const signedUrl = data.signedUrl;
      if (!signedUrl) throw new Error("Edge function did not return a signed URL.");

      const isPreviewable = file.file_type?.startsWith('image/') || file.file_type === 'application/pdf';

      if (isPreviewable) {
        window.open(signedUrl, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = signedUrl;
        link.setAttribute('download', file.file_name || 'download');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

    } catch (err: any) {
      showError(err.data?.error || err.message || "Fehler beim Herunterladen der Datei.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Sind Sie sicher, dass Sie die Datei "${file.file_name}" löschen möchten?`)) {
      setIsDeleting(true);
      deleteMutation.mutate({ id: file.id, path: file.file_path });
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3 overflow-hidden">
        <FileIcon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
        <div className="flex-grow overflow-hidden">
          <p className="font-medium truncate">{file.file_name}</p>
          <p className="text-xs text-muted-foreground">
            Hochgeladen von {`${file.first_name || ''} ${file.last_name || ''}`.trim() || 'Unbekannt'} am {new Date(file.created_at).toLocaleString('de-DE')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          onClick={handleDownload}
          disabled={isDownloading || isDeleting}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          onClick={handleDelete} 
          disabled={isDownloading || isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-destructive" />
          )}
        </Button>
      </div>
    </div>
  );
};