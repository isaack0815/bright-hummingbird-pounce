import { useState } from 'react';
import { Card, Button, ListGroup, Form, Badge, Spinner } from 'react-bootstrap';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { AddTodoDialog } from './AddTodoDialog';
import type { Todo } from '@/types/todo';
import { format, parseISO, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

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
    if (isPast(date) && date.toDateString() !== new Date().toDateString()) return <Badge bg="danger">Überfällig</Badge>;
    return <Badge bg="secondary">{format(date, 'dd.MM.yyyy', { locale: de })}</Badge>;
  };

  return (
    <>
      <Card className="h-100">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <Card.Title as="h6" className="mb-0">Meine ToDos</Card.Title>
          <Button variant="ghost" size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle size={16} />
          </Button>
        </Card.Header>
        <Card.Body style={{ overflowY: 'auto', maxHeight: '400px' }}>
          {isLoading ? (
            <div className="text-center"><Spinner animation="border" size="sm" /></div>
          ) : todos && todos.length > 0 ? (
            <ListGroup variant="flush">
              {todos.map(todo => (
                <ListGroup.Item key={todo.id} className={`d-flex align-items-start gap-3 ${todo.is_completed ? 'text-muted text-decoration-line-through' : ''}`}>
                  <Form.Check
                    type="checkbox"
                    checked={todo.is_completed}
                    onChange={(e) => updateStatusMutation.mutate({ id: todo.id, is_completed: e.target.checked })}
                    className="mt-1"
                  />
                  <div className="flex-grow-1">
                    <p className="mb-0 fw-medium">{todo.subject}</p>
                    <p className="small mb-1">{todo.description}</p>
                    <div className="d-flex align-items-center gap-2 small">
                      {getDueDateBadge(todo.due_date)}
                      <span>Erstellt von: {todo.creator_first_name || 'Unbekannt'}</span>
                    </div>
                  </div>
                  {user?.id === todo.created_by && (
                    <Button variant="ghost" size="sm" className="text-danger p-0" onClick={() => deleteMutation.mutate(todo.id)}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <p className="text-muted text-center">Keine ToDos vorhanden. Gut gemacht!</p>
          )}
        </Card.Body>
      </Card>
      <AddTodoDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} />
    </>
  );
}