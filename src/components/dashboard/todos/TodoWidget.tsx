import { useState } from 'react';
import { PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { AddTodoDialog } from './AddTodoDialog';
import type { Todo } from '@/types/todo';
import { format, parseISO, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const fetchTodos = async (): Promise<Todo[]> => {
  const { data, error } = await supabase.functions.invoke('get-my-todos');
  if (error) throw new Error(error.message);
  return data.todos;
};

export function TodoWidget() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: todos, isLoading } = useQuery<Todo[]>({
    queryKey: ['myTodos'],
    queryFn: fetchTodos,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: number, is_completed: boolean }) => {
      const { error } = await supabase.functions.invoke('update-todo-status', {
        body: { id, is_completed },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTodos'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Aktualisieren des Status."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-todo', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("ToDo gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['myTodos'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen des ToDos."),
  });

  const getDueDateBadge = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = parseISO(dueDate);
    const isOverdue = isPast(date) && date.toDateString() !== new Date().toDateString();
    return <Badge variant={isOverdue ? "destructive" : "secondary"}>{isOverdue ? 'Überfällig' : format(date, 'dd.MM.yyyy', { locale: de })}</Badge>;
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Meine ToDos</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : todos && todos.length > 0 ? (
            <div className="space-y-4">
              {todos.map(todo => (
                <div key={todo.id} className="flex items-start gap-4">
                  <Checkbox
                    id={`todo-${todo.id}`}
                    checked={todo.is_completed}
                    onCheckedChange={(checked) => updateStatusMutation.mutate({ id: todo.id, is_completed: !!checked })}
                    className="mt-1"
                  />
                  <div className={`flex-grow grid gap-1 ${todo.is_completed ? 'text-muted-foreground line-through' : ''}`}>
                    <label htmlFor={`todo-${todo.id}`} className="font-medium leading-none">{todo.subject}</label>
                    <p className="text-sm text-muted-foreground">{todo.description}</p>
                    <div className="flex items-center gap-2 text-sm">
                      {getDueDateBadge(todo.due_date)}
                      <span>Erstellt von: {todo.creator_first_name || 'Unbekannt'}</span>
                    </div>
                  </div>
                  {user?.id === todo.created_by && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(todo.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center">Keine ToDos vorhanden. Gut gemacht!</p>
          )}
        </CardContent>
      </Card>
      <AddTodoDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} />
    </>
  );
}