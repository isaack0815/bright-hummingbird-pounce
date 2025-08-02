import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, Form, Button, Placeholder, Image, Badge } from "react-bootstrap";
import { showError, showSuccess } from "@/utils/toast";
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

  if (!vehicleId) {
    return null;
  }

  return (
    <Card>
      <Card.Header><Card.Title>Notizen</Card.Title></Card.Header>
      <Card.Body>
        <div className="d-flex flex-column gap-2">
          <Form.Control
            as="textarea"
            placeholder="Neue Notiz hinzufügen..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <div className="d-flex gap-2">
            <div className="w-50">
                <CategoryCombobox value={selectedCategoryId} onChange={setSelectedCategoryId} />
            </div>
            <Button onClick={handleAddNote} disabled={mutation.isPending || !newNote.trim() || !selectedCategoryId}>
              {mutation.isPending ? "Wird hinzugefügt..." : "Notiz hinzufügen"}
            </Button>
          </div>
        </div>
        <div className="d-flex flex-column gap-4 mt-4">
          {isLoading && <Placeholder animation="glow"><Placeholder xs={12} style={{ height: '80px' }} /></Placeholder>}
          {notes?.map(note => (
            <div key={note.id} className="d-flex align-items-start gap-3">
              <Image src={`https://api.dicebear.com/8.x/initials/svg?seed=${note.first_name} ${note.last_name}`} roundedCircle style={{ width: 40, height: 40 }} />
              <div className="w-100 rounded border bg-light p-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="fw-semibold small mb-0">{`${note.first_name || ''} ${note.last_name || ''}`.trim()}</p>
                    <p className="small text-muted">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                  <Badge bg="secondary" pill>{note.category_name}</Badge>
                </div>
                <p className="small mt-2" style={{ whiteSpace: 'pre-wrap' }}>{note.note}</p>
              </div>
            </div>
          ))}
          {!isLoading && notes?.length === 0 && <p className="text-muted text-center">Keine Notizen vorhanden.</p>}
        </div>
      </Card.Body>
    </Card>
  );
};

export default VehicleNotesTab;