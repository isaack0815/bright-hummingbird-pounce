import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { VehicleNote } from "@/types/vehicle";
import { CategoryCombobox } from "./CategoryCombobox";

const fetchNotes = async (vehicleId: number): Promise<VehicleNote[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicle-notes', { body: { vehicleId } });
  if (error) throw error;
  return data.notes;
};

const addNote = async ({ vehicleId, note, categoryId }: { vehicleId: number, note: string, categoryId: number }) => {
  const { data, error } = await supabase.functions.invoke('create-vehicle-note', {
    body: { vehicleId, note, categoryId },
  });
  if (error) throw error;
  return data;
};

const VehicleNotesTab = ({ vehicleId }: { vehicleId: number | null }) => {
  const [newNote, setNewNote] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['vehicleNotes', vehicleId],
    queryFn: () => fetchNotes(vehicleId!),
    enabled: !!vehicleId,
  });

  const mutation = useMutation({
    mutationFn: addNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleNotes', vehicleId] });
      setNewNote("");
      setSelectedCategoryId(undefined);
      showSuccess("Notiz hinzugefügt!");
    },
    onError: (err: any) => showError(err.message || "Fehler beim Hinzufügen der Notiz."),
  });

  const handleAddNote = () => {
    if (!newNote.trim() || !vehicleId || !selectedCategoryId) {
        showError("Bitte wählen Sie eine Kategorie und geben Sie eine Notiz ein.");
        return;
    }
    mutation.mutate({ vehicleId, note: newNote, categoryId: selectedCategoryId });
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '??';
  };

  if (!vehicleId) {
    return null;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Notizen</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Neue Notiz hinzufügen..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <div className="flex gap-2">
            <div className="w-1/2">
                <CategoryCombobox value={selectedCategoryId} onChange={setSelectedCategoryId} />
            </div>
            <Button onClick={handleAddNote} disabled={mutation.isPending || !newNote.trim() || !selectedCategoryId}>
              {mutation.isPending ? "Wird hinzugefügt..." : "Notiz hinzufügen"}
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          {isLoading && <Skeleton className="h-20 w-full" />}
          {notes?.map(note => (
            <div key={note.id} className="flex items-start gap-4">
              <Avatar>
                <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${note.first_name} ${note.last_name}`} />
                <AvatarFallback>{getInitials(note.first_name, note.last_name)}</AvatarFallback>
              </Avatar>
              <div className="w-full rounded-md border bg-muted/50 p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{`${note.first_name || ''} ${note.last_name || ''}`.trim()}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                  <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2 py-1 rounded-full">{note.category_name}</span>
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{note.note}</p>
              </div>
            </div>
          ))}
          {!isLoading && notes?.length === 0 && <p className="text-muted-foreground text-center">Keine Notizen vorhanden.</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default VehicleNotesTab;