import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { AddMenuItemDialog } from '@/components/AddMenuItemDialog';
import { EditMenuItemDialog } from '@/components/EditMenuItemDialog';
import type { MenuItem } from '@/types/menu';

const buildTree = (items: MenuItem[]): MenuItem[] => {
  const itemMap = new Map<number, MenuItem>();
  const tree: MenuItem[] = [];

  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  items.forEach(item => {
    const currentItem = itemMap.get(item.id)!;
    if (item.parent_id && itemMap.has(item.parent_id)) {
      const parent = itemMap.get(item.parent_id);
      parent?.children?.push(currentItem);
    } else {
      tree.push(currentItem);
    }
  });

  const sortNodes = (nodes: MenuItem[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortNodes(node.children);
      }
    });
  };
  
  sortNodes(tree);
  return tree;
};

type MenuItemNodeProps = {
  item: MenuItem;
  siblings: MenuItem[];
  onEdit: (item: MenuItem) => void;
  onDelete: (id: number) => void;
  onMove: (itemId: number, direction: 'up' | 'down') => void;
};

function MenuItemNode({ item, siblings, onEdit, onDelete, onMove }: MenuItemNodeProps) {
  const itemIndex = siblings.findIndex(sibling => sibling.id === item.id);

  return (
    <div>
      <div className="flex items-center bg-background rounded-lg p-2 my-1 shadow-sm">
        <div className="flex-grow">{item.name}</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => onMove(item.id, 'up')} disabled={itemIndex === 0}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onMove(item.id, 'down')} disabled={itemIndex === siblings.length - 1}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {item.children && item.children.length > 0 && (
        <div className="pl-6 border-l-2 border-muted ml-4">
          {item.children.map(child => (
            <MenuItemNode
              key={child.id}
              item={child}
              siblings={item.children || []}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </div>
      )}
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

  const menuTree = useMemo(() => buildTree(items), [items]);

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

  const handleMove = (itemId: number, direction: 'up' | 'down') => {
    const findSiblingsAndParent = (nodes: MenuItem[], parentId: number | null): { siblings: MenuItem[], parentId: number | null } | null => {
      for (const node of nodes) {
        if (node.children?.some(child => child.id === itemId)) {
          return { siblings: node.children, parentId: node.id };
        }
        const found = findSiblingsAndParent(node.children || [], node.id);
        if (found) return found;
      }
      return null;
    };
    
    const result = findSiblingsAndParent(menuTree, null);
    const siblings = result ? result.siblings : menuTree;
    const index = siblings.findIndex(item => item.id === itemId);
    
    if (index === -1) return;

    const newSiblings = [...siblings];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    if (swapIndex < 0 || swapIndex >= newSiblings.length) return;

    [newSiblings[index], newSiblings[swapIndex]] = [newSiblings[swapIndex], newSiblings[index]];

    const itemsToUpdate = newSiblings.map((item, idx) => ({
      id: item.id,
      parent_id: item.parent_id,
      position: idx,
    }));

    updateStructureMutation.mutate(itemsToUpdate);
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
          <CardDescription>Verwalten Sie hier die Menüstruktur. Sie können die Reihenfolge mit den Pfeiltasten ändern.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Menüpunkte werden geladen...</p>
          ) : (
            <div>
              {menuTree.map(item => (
                <MenuItemNode
                  key={item.id}
                  item={item}
                  siblings={menuTree}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onMove={handleMove}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <AddMenuItemDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <EditMenuItemDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} item={selectedItem} />
    </div>
  );
};

export default MenuManagement;