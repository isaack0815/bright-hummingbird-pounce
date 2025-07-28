import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, GripVertical, Edit, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent,
  UniqueIdentifier,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AddMenuItemDialog } from '@/components/AddMenuItemDialog';
import { EditMenuItemDialog } from '@/components/EditMenuItemDialog';
import { createPortal } from 'react-dom';
import type { MenuItem } from '@/types/menu';

type TreeMenuItem = MenuItem & { children: TreeMenuItem[] };

type FlattenedItem = TreeMenuItem & {
  parentId: number | null;
  depth: number;
  index: number;
};

const INDENTATION_WIDTH = 24;

function buildTree(items: MenuItem[]): TreeMenuItem[] {
  const itemMap = new Map<number, TreeMenuItem>();
  const tree: TreeMenuItem[] = [];

  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  items.forEach(item => {
    if (item.parent_id && itemMap.has(item.parent_id)) {
      const parent = itemMap.get(item.parent_id)!;
      parent.children.push(itemMap.get(item.id)!);
    } else {
      tree.push(itemMap.get(item.id)!);
    }
  });

  const sortChildren = (node: TreeMenuItem) => {
    node.children.sort((a, b) => a.position - b.position);
    node.children.forEach(sortChildren);
  };
  tree.sort((a, b) => a.position - b.position);
  tree.forEach(sortChildren);

  return tree;
}

function flattenTree(items: TreeMenuItem[], parentId: number | null = null, depth = 0): FlattenedItem[] {
  return items.reduce<FlattenedItem[]>((acc, item, index) => {
    return [
      ...acc,
      { ...item, parentId, depth, index },
      ...flattenTree(item.children, item.id, depth + 1),
    ];
  }, []);
}

function getDragDepth(offset: number, indentationWidth: number) {
  return Math.round(offset / indentationWidth);
}

function SortableTreeItem({
  item,
  depth,
  isDragging,
  onEdit,
  onDelete,
}: {
  item: MenuItem;
  depth: number;
  isDragging?: boolean;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    paddingLeft: depth * INDENTATION_WIDTH,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center bg-background rounded-lg my-1 shadow-sm group">
      <div {...attributes} {...listeners} className="p-3 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-grow p-3">{item.name}</div>
      <div className="flex items-center gap-1 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
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
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

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

  const flattenedItems = useMemo(() => {
    const tree = buildTree(items);
    return flattenTree(tree);
  }, [items]);

  const activeItem = useMemo(() => activeId ? flattenedItems.find(({ id }) => id === activeId) : null, [activeId, flattenedItems]);
  
  const projected = activeId && overId ? getProjection(flattenedItems, activeId, overId, offsetLeft, INDENTATION_WIDTH) : null;

  const updateStructureMutation = useMutation({
    mutationFn: async (updatedItems: { id: number; parent_id: number | null; position: number }[]) => {
      const { error } = await supabase.functions.invoke('update-menu-structure', {
        body: { items: updatedItems },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Menüstruktur gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
    },
    onError: (err: any) => {
        showError(err.message || "Fehler beim Speichern der Struktur.");
        queryClient.invalidateQueries({ queryKey: ['menuItems'] });
    },
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

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
    setOverId(active.id);
  }

  function handleDragMove({ delta, over }: DragMoveEvent) {
    setOffsetLeft(delta.x);
    if (over) {
      setOverId(over.id);
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    resetState();

    if (projected && over && active.id !== over.id) {
        const { parentId } = projected;
        const activeIndex = flattenedItems.findIndex(({ id }) => id === active.id);
        const overIndex = flattenedItems.findIndex(({ id }) => id === over.id);
        
        const newOrderedItems = arrayMove(flattenedItems, activeIndex, overIndex);
        
        const movedItemInNewOrder = newOrderedItems.find(item => item.id === active.id)!;
        movedItemInNewOrder.parent_id = parentId;

        const finalUpdates = calculatePositions(newOrderedItems);
        
        updateStructureMutation.mutate(finalUpdates);
        
        // Optimistic update
        setItems(prev => {
            const newItems = prev.map(item => {
                const update = finalUpdates.find(u => u.id === item.id);
                if (update) {
                    return { ...item, parent_id: update.parent_id, position: update.position };
                }
                return item;
            });
            return newItems;
        });
    }
  }

  function handleDragCancel() {
    resetState();
  }

  function resetState() {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  }

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
            <CardDescription>Ordnen Sie Menüpunkte per Drag & Drop an. Ziehen Sie sie nach rechts, um sie zu verschachteln.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Menüpunkte werden geladen...</p>
            ) : (
              <SortableContext items={flattenedItems.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
                {flattenedItems.map(item => (
                  <SortableTreeItem
                    key={item.id}
                    item={item}
                    depth={item.id === activeId && projected ? projected.depth : item.depth}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
                {typeof document !== 'undefined' && createPortal(
                  <DragOverlay dropAnimation={null}>
                    {activeId && activeItem ? (
                      <SortableTreeItem
                        item={activeItem}
                        depth={activeItem.depth}
                        isDragging
                        onEdit={() => {}}
                        onDelete={() => {}}
                      />
                    ) : null}
                  </DragOverlay>,
                  document.body
                )}
              </SortableContext>
            )}
          </CardContent>
        </Card>
        <AddMenuItemDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
        <EditMenuItemDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} item={selectedItem} />
      </div>
    </DndContext>
  );
};

function getProjection(
  items: FlattenedItem[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  dragOffset: number,
  indentationWidth: number
) {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];
  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];
  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = previousItem ? previousItem.depth + 1 : 0;
  const minDepth = nextItem ? nextItem.depth : 0;
  let depth = projectedDepth;
  if (projectedDepth >= maxDepth) {
    depth = maxDepth;
  } else if (projectedDepth < minDepth) {
    depth = minDepth;
  }

  function getParentId() {
    if (depth === 0 || !previousItem) {
      return null;
    }
    if (depth === previousItem.depth) {
      return previousItem.parentId;
    }
    if (depth > previousItem.depth) {
      return previousItem.id;
    }
    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth - 1);
    return newParent ? newParent.id : null;
  }

  return { depth, parentId: getParentId() };
}

function calculatePositions(items: (MenuItem & { parent_id: number | null })[]): { id: number; parent_id: number | null; position: number }[] {
    const tree = buildTree(items);
    const updates: { id: number; parent_id: number | null; position: number }[] = [];

    function traverse(nodes: TreeMenuItem[], parentId: number | null) {
        nodes.forEach((node, index) => {
            updates.push({ id: node.id, parent_id: parentId, position: index });
            if (node.children.length > 0) {
                traverse(node.children, node.id);
            }
        });
    }

    traverse(tree, null);
    return updates;
}

export default MenuManagement;