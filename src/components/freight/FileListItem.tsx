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
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async ({ id, path }: { id: number, path: string }) => {
      // Try to remove from storage, but don't fail if it's already gone.
      await supabase.storage.from('order-files').remove([path]);
      
      // The critical part is deleting the database record.
      const { error: dbError } = await supabase.from('order_files').delete().eq('id', id);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderFiles', orderId] });
      showSuccess("Datei gelöscht!");
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen der Datei."),
  });

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('order-files')
        .createSignedUrl(file.file_path, 60); // Link is valid for 1 minute

      if (error) throw error;

      // Create a temporary link element to trigger the download reliably
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err: any) {
      showError(err.message || "Fehler beim Herunterladen der Datei.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Sind Sie sicher, dass Sie die Datei "${file.file_name}" löschen möchten?`)) {
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
          disabled={isDownloading}
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
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-destructive" />
          )}
        </Button>
      </div>
    </div>
  );
};