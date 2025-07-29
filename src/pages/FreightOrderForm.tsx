import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useError } from '@/contexts/ErrorContext';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import type { Customer } from '@/pages/CustomerManagement';
import type { FreightOrder } from '@/types/freight';
import { ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';

const stopSchema = z.object({
  stop_type: z.enum(['Abholung', 'Teillieferung']),
  address: z.string().min(1, "Adresse ist erforderlich."),
  stop_date: z.string().nullable(),
  time_start: z.string().nullable(),
  time_end: z.string().nullable(),
  position: z.number(),
});

const cargoItemSchema = z.object({
  quantity: z.coerce.number().nullable(),
  cargo_type: z.string().nullable(),
  description: z.string().nullable(),
  weight: z.coerce.number().nullable(),
  loading_meters: z.coerce.number().nullable(),
});

const formSchema = z.object({
  customer_id: z.coerce.number({ required_error: "Ein Kunde muss ausgewählt werden." }),
  external_order_number: z.string().optional(),
  status: z.string(),
  pickup_date: z.string().optional(),
  pickup_time_start: z.string().optional(),
  pickup_time_end: z.string().optional(),
  delivery_date: z.string().optional(),
  delivery_time_start: z.string().optional(),
  delivery_time_end: z.string().optional(),
  price: z.coerce.number().optional(),
  description: z.string().optional(),
  stops: z.array(stopSchema).optional(),
  cargoItems: z.array(cargoItemSchema).optional(),
});

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase.functions.invoke('get-customers');
  if (error) throw new Error(error.message);
  return data.customers;
};

const fetchOrder = async (id: string): Promise<FreightOrder> => {
    const { data, error } = await supabase.from('freight_orders').select('*, freight_order_stops(*), cargo_items(*)').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data as FreightOrder;
}

const FreightOrderForm = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addError } = useError();

  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });

  const { data: existingOrder, isLoading: isLoadingOrder } = useQuery<FreightOrder>({
    queryKey: ['freightOrder', id],
    queryFn: () => fetchOrder(id!),
    enabled: isEditMode,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: 'Angelegt',
      stops: [],
      cargoItems: [],
    },
  });

  const { fields: stopFields, append: appendStop, remove: removeStop } = useFieldArray({
    control: form.control,
    name: "stops",
  });

  const { fields: cargoFields, append: appendCargo, remove: removeCargo } = useFieldArray({
    control: form.control,
    name: "cargoItems",
  });

  useEffect(() => {
    if (isEditMode && existingOrder) {
      form.reset({
        customer_id: existingOrder.customer_id,
        external_order_number: existingOrder.external_order_number || '',
        status: existingOrder.status,
        pickup_date: existingOrder.pickup_date || '',
        pickup_time_start: existingOrder.pickup_time_start || '',
        pickup_time_end: existingOrder.pickup_time_end || '',
        delivery_date: existingOrder.delivery_date || '',
        delivery_time_start: existingOrder.delivery_time_start || '',
        delivery_time_end: existingOrder.delivery_time_end || '',
        price: existingOrder.price || undefined,
        description: existingOrder.description || '',
        stops: existingOrder.freight_order_stops.map(s => ({...s, stop_date: s.stop_date || null, time_start: s.time_start || null, time_end: s.time_end || null })) || [],
        cargoItems: existingOrder.cargo_items || [],
      });
    }
  }, [existingOrder, isEditMode, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { stops, cargoItems, ...orderData } = values;
      const payload = {
        orderData: {
            ...orderData,
            origin_address: stops && stops.length > 0 ? stops[0].address : null,
            destination_address: stops && stops.length > 0 ? stops[stops.length - 1].address : null,
        },
        stops,
        cargoItems,
      };

      if (isEditMode) {
        const { error } = await supabase.functions.invoke('update-freight-order', { body: { orderId: id, ...payload } });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke('create-freight-order', { body: payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess(`Auftrag erfolgreich ${isEditMode ? 'aktualisiert' : 'erstellt'}!`);
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
      navigate('/freight-orders');
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || `Fehler beim ${isEditMode ? 'Aktualisieren' : 'Erstellen'} des Auftrags.`);
    },
  });

  if (isLoadingCustomers || isLoadingOrder) {
      return <p>Lade Formulardaten...</p>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <div className="flex items-center justify-between">
            <div className='flex items-center gap-4'>
                <Button asChild variant="outline" size="icon">
                    <NavLink to="/freight-orders"><ArrowLeft className="h-4 w-4" /></NavLink>
                </Button>
                <h1 className="text-3xl font-bold">
                    {isEditMode ? `Auftrag ${existingOrder?.order_number} bearbeiten` : 'Neuer Frachtauftrag'}
                </h1>
            </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Wird gespeichert...' : 'Auftrag speichern'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {/* Stops Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Route & Stopps</CardTitle>
                        <CardDescription>Definieren Sie hier die Abhol-, Liefer- und Zwischenstopps.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {stopFields.map((field, index) => (
                            <Card key={field.id} className="p-4 relative">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name={`stops.${index}.address`} render={({ field }) => (
                                        <FormItem className="md:col-span-2"><FormLabel>Adresse</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`stops.${index}.stop_type`} render={({ field }) => (
                                        <FormItem><FormLabel>Stopp-Art</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent><SelectItem value="Abholung">Abholung</SelectItem><SelectItem value="Teillieferung">Teillieferung</SelectItem></SelectContent>
                                            </Select>
                                        <FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`stops.${index}.stop_date`} render={({ field }) => (
                                        <FormItem><FormLabel>Datum</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`stops.${index}.time_start`} render={({ field }) => (
                                        <FormItem><FormLabel>Zeitfenster (von)</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`stops.${index}.time_end`} render={({ field }) => (
                                        <FormItem><FormLabel>Zeitfenster (bis)</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeStop(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </Card>
                        ))}
                        <Button type="button" variant="outline" onClick={() => appendStop({ stop_type: 'Teillieferung', address: '', stop_date: null, time_start: null, time_end: null, position: stopFields.length })}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Stopp hinzufügen
                        </Button>
                    </CardContent>
                </Card>

                {/* Cargo Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Ladungsdetails</CardTitle>
                        <CardDescription>Fügen Sie hier die einzelnen Ladungspositionen hinzu.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         {cargoFields.map((field, index) => (
                            <Card key={field.id} className="p-4 relative">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <FormField control={form.control} name={`cargoItems.${index}.quantity`} render={({ field }) => (
                                        <FormItem><FormLabel>Anzahl</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`cargoItems.${index}.cargo_type`} render={({ field }) => (
                                        <FormItem><FormLabel>Art</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`cargoItems.${index}.description`} render={({ field }) => (
                                        <FormItem><FormLabel>Bezeichnung</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`cargoItems.${index}.weight`} render={({ field }) => (
                                        <FormItem><FormLabel>Gewicht (kg)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || ''} /></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`cargoItems.${index}.loading_meters`} render={({ field }) => (
                                        <FormItem><FormLabel>Lademeter</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || ''} /></FormControl></FormItem>
                                    )} />
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeCargo(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </Card>
                        ))}
                        <Button type="button" variant="outline" onClick={() => appendCargo({ quantity: 1, cargo_type: '', description: '', weight: null, loading_meters: null })}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Ladungsposition hinzufügen
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Side Card */}
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Allgemeine Informationen</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="customer_id" render={({ field }) => (
                            <FormItem><FormLabel>Kunde</FormLabel>
                                <Select onValueChange={field.onChange} value={String(field.value)}>
                                    <FormControl><SelectTrigger disabled={isLoadingCustomers}><SelectValue placeholder="Kunde wählen" /></SelectTrigger></FormControl>
                                    <SelectContent>{customers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>)}</SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="external_order_number" render={({ field }) => (
                            <FormItem><FormLabel>Externe Auftragsnummer</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="status" render={({ field }) => (
                            <FormItem><FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Angelegt">Angelegt</SelectItem>
                                        <SelectItem value="Geplant">Geplant</SelectItem>
                                        <SelectItem value="Unterwegs">Unterwegs</SelectItem>
                                        <SelectItem value="Zugestellt">Zugestellt</SelectItem>
                                        <SelectItem value="Storniert">Storniert</SelectItem>
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="price" render={({ field }) => (
                            <FormItem><FormLabel>Preis (€)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Beschreibung / Notizen</FormLabel><FormControl><Textarea {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </CardContent>
                </Card>
            </div>
        </div>
      </form>
    </Form>
  );
};

export default FreightOrderForm;