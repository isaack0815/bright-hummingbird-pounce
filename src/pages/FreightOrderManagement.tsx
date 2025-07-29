import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useError } from '@/contexts/ErrorContext';
import type { FreightOrder } from '@/types/freight';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderTable } from '@/components/freight/OrderTable';

const fetchFreightOrders = async (): Promise<FreightOrder[]> => {
  const { data, error } = await supabase.functions.invoke('get-freight-orders');
  if (error) throw new Error(error.message);
  return data.orders;
};

const FreightOrderManagement = () => {
  const queryClient = useQueryClient();
  const { addError } = useError();
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const handleDeleteClick = (id: number) => {
    if (window.confirm("Sind Sie sicher, dass Sie diesen Auftrag löschen möchten?")) {
      deleteMutation.mutate(id);
    }
  };

  const { myOrders, otherOrders, completedOrders } = useMemo(() => {
    if (!orders || !user) {
      return { myOrders: [], otherOrders: [], completedOrders: [] };
    }

    const activeOrders = orders.filter(o => o.status !== 'Zugestellt' && o.status !== 'Storniert');
    const completed = orders.filter(o => o.status === 'Zugestellt' || o.status === 'Storniert');

    return {
      myOrders: activeOrders.filter(o => o.created_by === user.id),
      otherOrders: activeOrders.filter(o => o.created_by !== user.id),
      completedOrders: completed,
    };
  }, [orders, user]);

  if (error) {
    addError(error, 'API');
    showError(`Fehler beim Laden der Aufträge: ${error.message}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Frachtaufträge</h1>
        <Button onClick={() => navigate('/freight-orders/new')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Auftrag hinzufügen
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Auftragsliste</CardTitle>
          <CardDescription>Hier sehen Sie alle für Sie zugänglichen Aufträge, aufgeteilt nach Kategorien.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="my-orders">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="my-orders">Meine Aufträge</TabsTrigger>
              <TabsTrigger value="other-orders">Aufträge anderer</TabsTrigger>
              <TabsTrigger value="completed-orders">Abgeschlossen</TabsTrigger>
            </TabsList>
            <TabsContent value="my-orders" className="mt-4">
              {isLoading ? <p>Lade Aufträge...</p> : <OrderTable orders={myOrders} onDelete={handleDeleteClick} />}
            </TabsContent>
            <TabsContent value="other-orders" className="mt-4">
              {isLoading ? <p>Lade Aufträge...</p> : <OrderTable orders={otherOrders} onDelete={handleDeleteClick} />}
            </TabsContent>
            <TabsContent value="completed-orders" className="mt-4">
              {isLoading ? <p>Lade Aufträge...</p> : <OrderTable orders={completedOrders} onDelete={handleDeleteClick} />}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default FreightOrderManagement;