import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "../ui/skeleton";
import { v4 as uuidv4 } from 'uuid';
import { FileListItem } from "./FileListItem";

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
            <FileListItem key={file.id} file={file} orderId={orderId} />
          ))}
          {!isLoading && files?.length === 0 && <p className="text-muted-foreground text-center">Keine Dateien vorhanden.</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default FilesTab;