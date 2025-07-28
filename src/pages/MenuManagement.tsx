import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, GripVertical, Edit, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AddMenuItemDialog } from '@/components/AddMenuItemDialog';
import { EditMenuItemDialog } from '@/components/EditMenuItemDialog';

export type MenuItem = {
  id: number;
  parent_id: number | null;
  name: string;
  link: string | null;
  icon: string | null;
  position: number;
  children?: MenuItem[];
};

type SortableItemProps = {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: number) => void;
};

function SortableItem({ item, onEdit, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center bg-background rounded-lg p-2 my-1 shadow-sm">
      <div {...attributes} {...listeners} className="p-2 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-grow">{item.name}</div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const fetchMenuItems = async (): Promise<MenuItem[]> => {
  const { data, error } = await supabase.functions.invoke('get-menu-items');
  if (error) throw new Error(error.message);
  return data.items;
};

const MenuManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const queryClient = useQueryClient();

  const { data: fetchedItems, isLoading, error } = useQuery<MenuItem[]>({
    queryKey: ['menuItems'],
    queryFn: fetchMenuItems,
  });

  useEffect(() => {
    if (fetchedItems) {
      setItems(fetchedItems);
    }
  }, [fetchedItems]);

  const updateStructureMutation = useMutation({
    mutationFn: async (updatedItems: { id: number; parentId: number | null; position: number }[]) => {
      const { error } = await supabase.functions.invoke('update-menu-structure', {
        body: { items: updatedItems },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Menüstruktur gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern der Struktur."),
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-menu-item', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Menüpunkt gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen."),
  });

  const sensors = useSensors(useSensor(PointerSensor));
  const sortedItemIds = useMemo(() => items.map(item => item.id), [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      const itemsToUpdate = newItems.map((item, index) => ({
        id: item.id,
        parentId: item.parent_id, // Nesting logic to be added in a future step
        position: index,
      }));
      updateStructureMutation.mutate(itemsToUpdate);
    }
  };
  
  const handleEdit = (item: MenuItem) => {
    setSelectedItem(item);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Sind Sie sicher, dass Sie diesen Menüpunkt (und alle Unterpunkte) löschen möchten?")) {
      deleteMutation.mutate(id);
    }
  };

  if (error) {
    showError(`Fehler beim Laden der Menüpunkte: ${error.message}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Menüverwaltung</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Menüpunkt hinzufügen
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Menü-Editor</CardTitle>
          <CardDescription>Ordnen Sie Menüpunkte per Drag & Drop an. Verschachtelung wird in Kürze verfügbar sein.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Menüpunkte werden geladen...</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedItemIds} strategy={verticalListSortingStrategy}>
                {items.map(item => (
                  <SortableItem key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
      <AddMenuItemDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <EditMenuItemDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} item={selectedItem} />
    </div>
  );
};

export default MenuManagement;