import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useError } from '@/contexts/ErrorContext';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Vehicle } from '@/types/vehicle';
import type { ChatUser } from '@/types/chat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formSchema = z.object({
  license_plate: z.string().min(1, "Kennzeichen ist erforderlich."),
  brand: z.string().optional(),
  model: z.string().optional(),
  type: z.string().optional(),
  vin: z.string().optional(),
  year_of_manufacture: z.coerce.number().optional(),
  inspection_due_date: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
  loading_area: z.coerce.number().optional(),
  next_service_date: z.string().optional(),
  gas_inspection_due_date: z.string().optional(),
  driver_id: z.string().uuid().nullable().optional(),
});

const fetchUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

const fetchVehicle = async (id: string): Promise<Vehicle> => {
  const { data, error } = await supabase.functions.invoke('get-vehicle', {
    body: { id: parseInt(id, 10) },
  });
  if (error) throw new Error(error.message);
  if (!data || !data.vehicle) throw new Error("Fahrzeug nicht gefunden");
  return data.vehicle;
}

const VehicleForm = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addError } = useError();

  const { data: users, isLoading: isLoadingUsers } = useQuery<ChatUser[]>({
    queryKey: ['chatUsers'],
    queryFn: fetchUsers,
  });

  const { data: existingVehicle, isLoading: isLoadingVehicle } = useQuery<Vehicle>({
    queryKey: ['vehicle', id],
    queryFn: () => fetchVehicle(id!),
    enabled: isEditMode,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      license_plate: "",
      brand: "",
      model: "",
      type: "Sattelzugmaschine",
      vin: "",
      status: "Verfügbar",
      notes: "",
      driver_id: null,
    },
  });

  useEffect(() => {
    if (isEditMode && existingVehicle) {
      form.reset({
        license_plate: existingVehicle.license_plate,
        brand: existingVehicle.brand || "",
        model: existingVehicle.model || "",
        type: existingVehicle.type || "",
        vin: existingVehicle.vin || "",
        year_of_manufacture: existingVehicle.year_of_manufacture || undefined,
        inspection_due_date: existingVehicle.inspection_due_date || "",
        status: existingVehicle.status,
        notes: existingVehicle.notes || "",
        loading_area: existingVehicle.loading_area || undefined,
        next_service_date: existingVehicle.next_service_date || "",
        gas_inspection_due_date: existingVehicle.gas_inspection_due_date || "",
        driver_id: existingVehicle.driver_id || null,
      });
    }
  }, [existingVehicle, isEditMode, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>): Promise<Vehicle> => {
      const payload = { ...values, driver_id: values.driver_id || null };
      
      if (isEditMode) {
        const { data, error } = await supabase.functions.invoke('update-vehicle', {
          body: { id: existingVehicle!.id, ...payload },
        });
        if (error) throw error;
        return data.vehicle;
      } else {
        const { data, error } = await supabase.functions.invoke('create-vehicle', {
          body: payload,
        });
        if (error) throw error;
        return data.vehicle;
      }
    },
    onSuccess: (data) => {
      showSuccess(`Fahrzeug erfolgreich ${isEditMode ? 'aktualisiert' : 'erstellt'}!`);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      if (!isEditMode) {
        navigate(`/vehicles/edit/${data.id}`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
      }
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || `Fehler beim ${isEditMode ? 'Aktualisieren' : 'Erstellen'} des Fahrzeugs.`);
    },
  });

  if (isLoadingUsers || isLoadingVehicle) {
      return <p>Lade Formulardaten...</p>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <div className="flex items-center justify-between">
            <div className='flex items-center gap-4'>
                <Button asChild variant="outline" size="icon">
                    <NavLink to="/vehicles"><ArrowLeft className="h-4 w-4" /></NavLink>
                </Button>
                <h1 className="text-3xl font-bold">
                    {isEditMode ? `Fahrzeug ${existingVehicle?.license_plate} bearbeiten` : 'Neues Fahrzeug'}
                </h1>
            </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Wird gespeichert...' : 'Fahrzeug speichern'}
          </Button>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Allgemein</TabsTrigger>
            <TabsTrigger value="notes" disabled>Notizen (bald)</TabsTrigger>
            <TabsTrigger value="files" disabled>Dateien (bald)</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Fahrzeugdetails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="license_plate" render={({ field }) => (
                      <FormItem><FormLabel>Kennzeichen</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField
                      control={form.control}
                      name="driver_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fahrer</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                            value={field.value ?? "none"}
                            disabled={isLoadingUsers}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Fahrer auswählen..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">- Kein Fahrer -</SelectItem>
                              {users?.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {`${user.first_name || ''} ${user.last_name || ''}`.trim()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="brand" render={({ field }) => (
                        <FormItem><FormLabel>Marke</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="model" render={({ field }) => (
                        <FormItem><FormLabel>Modell</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem><FormLabel>Fahrzeugtyp</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Sattelzugmaschine">Sattelzugmaschine</SelectItem>
                            <SelectItem value="Anhänger">Anhänger</SelectItem>
                            <SelectItem value="Transporter">Transporter</SelectItem>
                            <SelectItem value="LKW">LKW</SelectItem>
                          </SelectContent>
                        </Select>
                      <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="vin" render={({ field }) => (
                      <FormItem><FormLabel>Fahrgestellnummer (VIN)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="year_of_manufacture" render={({ field }) => (
                        <FormItem><FormLabel>Baujahr</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="loading_area" render={({ field }) => (
                        <FormItem><FormLabel>Ladefläche (m²)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="inspection_due_date" render={({ field }) => (
                        <FormItem><FormLabel>Nächste HU</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="next_service_date" render={({ field }) => (
                        <FormItem><FormLabel>Nächster Service</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="gas_inspection_due_date" render={({ field }) => (
                        <FormItem><FormLabel>Nächste Gasdurchsicht</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem><FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Verfügbar">Verfügbar</SelectItem>
                            <SelectItem value="In Reparatur">In Reparatur</SelectItem>
                            <SelectItem value="Unterwegs">Unterwegs</SelectItem>
                            <SelectItem value="Außer Betrieb">Außer Betrieb</SelectItem>
                          </SelectContent>
                        </Select>
                      <FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notizen</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="notes">
            {/* Placeholder for future notes component */}
          </TabsContent>
          <TabsContent value="files">
            {/* Placeholder for future files component */}
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
};

export default VehicleForm;