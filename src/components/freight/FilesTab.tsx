import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "../ui/skeleton";
import { File as FileIcon, Trash2, Download } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

type OrderFile = {
  id: number;
  file_name: string;
  file_path: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
};

const fetchFiles = async (orderId: number): Promise<OrderFile[]> => {
  const { data, error } = await supabase
    .from('order_files_with_profile')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
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

  const deleteMutation = useMutation({
    mutationFn: async ({ id, path }: { id: number, path: string }) => {
      const { error: storageError } = await supabase.storage.from('order-files').remove([path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('order_files').delete().eq('id', id);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderFiles', orderId] });
      showSuccess("Datei gelöscht!");
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen der Datei."),
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !orderId || !user) return;

    setUploading(true);
    try {
      const filePath = `${orderId}/${uuidv4()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('order-files').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('order_files').insert({
        order_id: orderId,
        user_id: user.id,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ['orderFiles', orderId] });
      showSuccess("Datei erfolgreich hochgeladen!");
    } catch (err: any) {
      showError(err.message || "Fehler beim Hochladen der Datei.");
    } finally {
      setUploading(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleDownload = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('order-files').download(filePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('-').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showError(err.message || "Fehler beim Herunterladen der Datei.");
    }
  };

  if (!orderId) {
    return (
      <Card>
        <CardHeader><CardTitle>Dateien</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Bitte speichern Sie den Auftrag zuerst, um Dateien hochzuladen.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Dateien</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Input type="file" onChange={handleFileUpload} disabled={uploading} />
          {uploading && <p className="text-sm text-muted-foreground mt-2">Wird hochgeladen...</p>}
        </div>
        <div className="space-y-2">
          {isLoading && <Skeleton className="h-12 w-full" />}
          {files?.map(file => (
            <div key={file.id} className="flex items-center justify-between rounded-md border p-3">
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
                <Button type="button" variant="ghost" size="icon" onClick={() => handleDownload(file.file_path)}><Download className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: file.id, path: file.file_path })} disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {!isLoading && files?.length === 0 && <p className="text-muted-foreground text-center">Keine Dateien vorhanden.</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default FilesTab;