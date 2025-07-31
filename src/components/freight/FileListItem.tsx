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
    console.log(`[1] handleDownload called for: ${file.file_name}`);
    if (!file.file_path) {
      console.error("[ERROR] No file path found for this file.");
      showError("Kein Dateipfad für diese Datei vorhanden.");
      return;
    }
    
    console.log(`[2] Setting isDownloading to true.`);
    setIsDownloading(true);

    try {
      console.log(`[3] Attempting to create signed URL for path: ${file.file_path}`);
      const { data, error } = await supabase.storage
        .from('order-files')
        .createSignedUrl(file.file_path, 60); // URL is valid for 60 seconds

      if (error) {
        console.error("[ERROR] Supabase storage error:", error);
        throw error;
      }
      
      console.log("[4] Successfully created signed URL:", data.signedUrl);

      const newWindow = window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      if (!newWindow) {
          console.warn("[WARN] Pop-up was blocked by the browser.");
          showError("Pop-up wurde blockiert. Bitte erlauben Sie Pop-ups für diese Seite.");
      } else {
          console.log("[5] Pop-up window opened successfully.");
      }

    } catch (err: any) {
      console.error("[6] CATCH BLOCK: An error occurred during download:", err);
      showError(err.message || "Fehler beim Herunterladen der Datei.");
    } finally {
      console.log("[7] FINALLY BLOCK: Setting isDownloading to false after a delay.");
      setTimeout(() => {
        setIsDownloading(false);
        console.log("[8] isDownloading is now false.");
      }, 500);
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