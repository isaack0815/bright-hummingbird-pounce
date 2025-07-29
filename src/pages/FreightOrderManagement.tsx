import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { AddFreightOrderDialog } from '@/components/AddFreightOrderDialog';
import { EditFreightOrderDialog } from '@/components/EditFreightOrderDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useError } from '@/contexts/ErrorContext';
import type { FreightOrder } from '@/types/freight';
import { Badge } from '@/components/ui/badge';

const fetchFreightOrders = async (): Promise<FreightOrder[]> => {
  const { data, error } = await supabase.functions.invoke('get-freight-orders');
  if (error) throw new Error(error.message);
  return data.orders;
};

const FreightOrderManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<FreightOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { addError } = useError();

  const { data: orders, isLoading, error } = useQuery<FreightOrder[]>({
    queryKey: ['freightOrders'],
    queryFn: fetchFreightOrders,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-freight-order', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Auftrag erfolgreich gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.message || "Fehler beim Löschen des Auftrags.");
    },
  });

  const handleEditClick = (order: FreightOrder) => {
    setSelectedOrder(order);
    setIsEditDialogOpen(true);
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(order =>
      order.customers?.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.origin_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.destination_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(order.id).includes(searchTerm)
    );
  }, [orders, searchTerm]);

  if (error) {
    addError(error, 'API');
    showError(`Fehler beim Laden der Aufträge: ${error.message}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Frachtaufträge</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Auftrag hinzufügen
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Auftragsliste</CardTitle>
          <CardDescription>Suchen, bearbeiten und verwalten Sie Ihre Frachtaufträge.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Aufträge suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {isLoading ? (
            <p>Aufträge werden geladen...</p>
          ) : filteredOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Auftrag #</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Von</TableHead>
                  <TableHead>Nach</TableHead>
                  <TableHead>Abholdatum</TableHead>
                  <TableHead>
                    <span className="sr-only">Aktionen</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.customers?.company_name || 'N/A'}</TableCell>
                    <TableCell><Badge>{order.status}</Badge></TableCell>
                    <TableCell>{order.origin_address}</TableCell>
                    <TableCell>{order.destination_address}</TableCell>
                    <TableCell>{order.pickup_date ? new Date(order.pickup_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditClick(order)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(order.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">Keine Aufträge gefunden.</p>
          )}
        </CardContent>
      </Card>
      <AddFreightOrderDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <EditFreightOrderDialog order={selectedOrder} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
    </div>
  );
};

export default FreightOrderManagement;