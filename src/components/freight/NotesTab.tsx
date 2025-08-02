import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, Form, Button, Placeholder, Image } from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/toast";
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

type Note = {
  id: number;
  note: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
};

const fetchNotes = async (orderId: number): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('order_notes_with_profile')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

const addNote = async ({ orderId, note, userId }: { orderId: number, note: string, userId: string }) => {
  const { data, error } = await supabase
    .from('order_notes')
    .insert({ order_id: orderId, note, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

const NotesTab = ({ orderId }: { orderId: number | null }) => {
  const [newNote, setNewNote] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['orderNotes', orderId],
    queryFn: () => fetchNotes(orderId!),
    enabled: !!orderId,
  });

  const mutation = useMutation({
    mutationFn: addNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderNotes', orderId] });
      setNewNote("");
      showSuccess("Notiz hinzugefügt!");
    },
    onError: (err: any) => showError(err.message || "Fehler beim Hinzufügen der Notiz."),
  });

  const handleAddNote = () => {
    if (!newNote.trim() || !orderId || !user) return;
    mutation.mutate({ orderId, note: newNote, userId: user.id });
  };

  if (!orderId) {
    return (
      <Card>
        <Card.Header><Card.Title>Notizen</Card.Title></Card.Header>
        <Card.Body><p className="text-muted">Bitte speichern Sie den Auftrag zuerst, um Notizen hinzuzufügen.</p></Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header><Card.Title>Notizen</Card.Title></Card.Header>
      <Card.Body className="d-flex flex-column gap-4">
        <div className="d-flex flex-column gap-2">
          <Form.Control
            as="textarea"
            placeholder="Neue Notiz hinzufügen..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <Button onClick={handleAddNote} disabled={mutation.isPending || !newNote.trim()} className="align-self-start">
            {mutation.isPending ? "Wird hinzugefügt..." : "Notiz hinzufügen"}
          </Button>
        </div>
        <div className="d-flex flex-column gap-4">
          {isLoading && <Placeholder animation="glow"><Placeholder xs={12} style={{ height: '80px' }} /></Placeholder>}
          {notes?.map(note => (
            <div key={note.id} className="d-flex align-items-start gap-3">
              <Image src={`https://api.dicebear.com/8.x/initials/svg?seed=${note.first_name} ${note.last_name}`} roundedCircle style={{ width: 40, height: 40 }} />
              <div className="w-100 rounded border bg-light p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <p className="fw-semibold small mb-0">{`${note.first_name || ''} ${note.last_name || ''}`.trim()}</p>
                  <p className="small text-muted mb-0">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: de })}
                  </p>
                </div>
                <p className="small mt-1" style={{ whiteSpace: 'pre-wrap' }}>{note.note}</p>
              </div>
            </div>
          ))}
          {!isLoading && notes?.length === 0 && <p className="text-muted text-center">Keine Notizen vorhanden.</p>}
        </div>
      </Card.Body>
    </Card>
  );
};

export default NotesTab;