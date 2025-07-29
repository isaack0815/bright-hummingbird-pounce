import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

type Note = {
  id: number;
  note: string;
  created_at: string;
  profiles: { first_name: string | null, last_name: string | null } | null;
};

const fetchNotes = async (orderId: number): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('order_notes')
    .select('id, note, created_at, profiles(first_name, last_name)')
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

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '??';
  };

  if (!orderId) {
    return (
      <Card>
        <CardHeader><CardTitle>Notizen</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Bitte speichern Sie den Auftrag zuerst, um Notizen hinzuzufügen.</p></CardContent>
      </Card>
    );
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
          <Button onClick={handleAddNote} disabled={mutation.isPending || !newNote.trim()}>
            {mutation.isPending ? "Wird hinzugefügt..." : "Notiz hinzufügen"}
          </Button>
        </div>
        <div className="space-y-4">
          {isLoading && <Skeleton className="h-20 w-full" />}
          {notes?.map(note => (
            <div key={note.id} className="flex items-start gap-4">
              <Avatar>
                <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${note.profiles?.first_name} ${note.profiles?.last_name}`} />
                <AvatarFallback>{getInitials(note.profiles?.first_name, note.profiles?.last_name)}</AvatarFallback>
              </Avatar>
              <div className="w-full rounded-md border bg-muted/50 p-3">
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-sm">{`${note.profiles?.first_name || ''} ${note.profiles?.last_name || ''}`.trim()}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: de })}
                  </p>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{note.note}</p>
              </div>
            </div>
          ))}
          {!isLoading && notes?.length === 0 && <p className="text-muted-foreground text-center">Keine Notizen vorhanden.</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotesTab;