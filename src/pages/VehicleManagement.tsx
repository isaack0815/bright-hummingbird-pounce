import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { AddVehicleDialog } from '@/components/AddVehicleDialog';
import { EditVehicleDialog } from '@/components/EditVehicleDialog';
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
import type { Vehicle } from '@/types/vehicle';
import { Badge } from '@/components/ui/badge';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const fetchVehicles = async (): Promise<Vehicle[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicles');
  if (error) throw new Error(error.message);
  return data.vehicles;
};

const VehicleManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { addError } = useError();

  const { data: vehicles, isLoading, error } = useQuery<Vehicle[]>({
    queryKey: ['vehicles'],
    queryFn: fetchVehicles,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-vehicle', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Fahrzeug erfolgreich gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.message || "Fehler beim Löschen des Fahrzeugs.");
    },
  });

  const handleEditClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsEditDialogOpen(true);
  };

  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    return vehicles.filter(vehicle =>
      vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.vin?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vehicles, searchTerm]);

  const getInspectionBadgeVariant = (dateStr: string | null): 'default' | 'destructive' | 'secondary' => {
    if (!dateStr) return 'secondary';
    const daysUntil = differenceInCalendarDays(parseISO(dateStr), new Date());
    if (daysUntil < 0) return 'destructive';
    if (daysUntil <= 30) return 'default'; // 'default' is orange-ish in this theme
    return 'secondary';
  };

  if (error) {
    addError(error, 'API');
    showError(`Fehler beim Laden der Fahrzeuge: ${error.message}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Fahrzeugverwaltung</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Fahrzeug hinzufügen
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Fahrzeugliste</CardTitle>
          <CardDescription>Suchen, bearbeiten und verwalten Sie Ihren Fuhrpark.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Fahrzeuge suchen (Kennzeichen, Marke...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {isLoading ? (
            <p>Fahrzeuge werden geladen...</p>
          ) : filteredVehicles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kennzeichen</TableHead>
                  <TableHead>Marke & Modell</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nächste HU</TableHead>
                  <TableHead><span className="sr-only">Aktionen</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.license_plate}</TableCell>
                    <TableCell>{`${vehicle.brand || ''} ${vehicle.model || ''}`.trim()}</TableCell>
                    <TableCell>{vehicle.type}</TableCell>
                    <TableCell><Badge variant={vehicle.status === 'Verfügbar' ? 'default' : 'secondary'}>{vehicle.status}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={getInspectionBadgeVariant(vehicle.inspection_due_date)}>
                        {vehicle.inspection_due_date ? new Date(vehicle.inspection_due_date).toLocaleDateString() : '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditClick(vehicle)}><Edit className="mr-2 h-4 w-4" />Bearbeiten</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(vehicle.id)}><Trash2 className="mr-2 h-4 w-4" />Löschen</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">Keine Fahrzeuge gefunden.</p>
          )}
        </CardContent>
      </Card>
      <AddVehicleDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <EditVehicleDialog vehicle={selectedVehicle} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
    </div>
  );
};

export default VehicleManagement;