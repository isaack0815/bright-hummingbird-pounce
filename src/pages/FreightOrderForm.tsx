import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, Card, Form, Tabs, Tab, Row, Col, Spinner } from 'react-bootstrap';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useError } from '@/contexts/ErrorContext';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import type { Customer } from '@/pages/CustomerManagement';
import type { FreightOrder } from '@/types/freight';
import type { Setting } from '@/types/settings';
import { ArrowLeft, PlusCircle, Trash2, Share2, MapPin, Package, Info, Loader2 } from 'lucide-react';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { AddCustomerDialog } from '@/components/AddCustomerDialog';
import NotesTab from '@/components/freight/NotesTab';
import FilesTab from '@/components/freight/FilesTab';
import TeamTab from '@/components/freight/TeamTab';
import StatusHistoryTab from '@/components/freight/StatusHistoryTab';
import { useAuth } from '@/contexts/AuthContext';
import { AssignExternalOrderDialog } from '@/components/freight/AssignExternalOrderDialog';
import type { Vehicle } from '@/types/vehicle';

const stopSchema = z.object({
  stop_type: z.enum(['Abholung', 'Teillieferung', 'Teilladung', 'Lieferung']),
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
  price: z.coerce.number().optional(),
  description: z.string().optional(),
  stops: z.array(stopSchema).min(1, "Es muss mindestens ein Stopp vorhanden sein."),
  cargoItems: z.array(cargoItemSchema).optional(),
  vehicle_id: z.coerce.number().nullable().optional(),
});

type FormSchemaType = z.infer<typeof formSchema>;

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase.functions.invoke('manage-customers', {
    body: { action: 'get' }
  });
  if (error) throw new Error(error.message);
  return data.customers;
};

const fetchVehicles = async (): Promise<Vehicle[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicles');
  if (error) throw new Error(error.message);
  return data.vehicles;
};

const fetchOrder = async (id: string): Promise<FreightOrder> => {
    const { data, error } = await supabase.from('freight_orders').select('*, customers(id, company_name), freight_order_stops(*), cargo_items(*)').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data as FreightOrder;
}

const fetchSettings = async (): Promise<Setting[]> => {
    const { data, error } = await supabase.functions.invoke('get-settings');
    if (error) throw new Error(error.message);
    return data.settings;
};

const FreightOrderForm = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addError } = useError();
  const { user } = useAuth();
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [routeDetails, setRouteDetails] = useState<{ distance: number | null, cost: number | null }>({ distance: null, cost: null });
  const [isCalculating, setIsCalculating] = useState(false);
  const lastCalculatedAddresses = useRef({ origin: '', destination: '' });

  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });

  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ['vehicles'],
    queryFn: fetchVehicles,
  });

  const { data: settingsArray, isLoading: isLoadingSettings } = useQuery<Setting[]>({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const settings = useMemo(() => {
    if (!settingsArray) return {};
    const settingsMap = new Map(settingsArray.map((s) => [s.key, s.value]));
    return {
        price_per_km_small: Number(settingsMap.get('price_per_km_small')) || 0.9,
        price_per_km_large: Number(settingsMap.get('price_per_km_large')) || 1.8,
        weight_limit_small_kg: Number(settingsMap.get('weight_limit_small_kg')) || 1000,
        loading_meters_limit_small: Number(settingsMap.get('loading_meters_limit_small')) || 4.5,
        payment_term_default: settingsMap.get('payment_term_default'),
        agb_text: settingsMap.get('agb_text'),
    };
  }, [settingsArray]);

  const { data: existingOrder, isLoading: isLoadingOrder, isFetching: isFetchingOrder } = useQuery<FreightOrder>({
    queryKey: ['freightOrder', id],
    queryFn: () => fetchOrder(id!),
    enabled: isEditMode,
  });

  const form = useForm<FormSchemaType>({
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

  const watchedStops = form.watch('stops');
  const watchedCargo = form.watch('cargoItems');

  useEffect(() => {
    const calculateRoute = async () => {
        if (watchedStops.length < 2) {
            setRouteDetails({ distance: null, cost: null });
            return;
        }
        const origin = watchedStops[0].address;
        const destination = watchedStops[watchedStops.length - 1].address;

        if (!origin || !destination || (origin === lastCalculatedAddresses.current.origin && destination === lastCalculatedAddresses.current.destination)) {
            return;
        }
        
        lastCalculatedAddresses.current = { origin, destination };
        setIsCalculating(true);

        try {
            const { data, error } = await supabase.functions.invoke('calculate-route-details', {
                body: { origin, destination }
            });
            if (error) throw error;

            if (data.distance) {
                const distanceInKm = data.distance / 1000;
                const totalWeight = watchedCargo?.reduce((sum, item) => sum + (item.weight || 0), 0) || 0;
                const totalLoadingMeters = watchedCargo?.reduce((sum, item) => sum + (item.loading_meters || 0), 0) || 0;

                const isLargeTransport = totalWeight > settings.weight_limit_small_kg || totalLoadingMeters > settings.loading_meters_limit_small;
                const pricePerKm = isLargeTransport ? settings.price_per_km_large : settings.price_per_km_small;
                const cost = distanceInKm * pricePerKm;

                setRouteDetails({ distance: distanceInKm, cost });
            } else {
                setRouteDetails({ distance: null, cost: null });
            }
        } catch (err: any) {
            console.error("Error calculating route:", err);
            setRouteDetails({ distance: null, cost: null });
        } finally {
            setIsCalculating(false);
        }
    };

    const timeoutId = setTimeout(calculateRoute, 1000); // Debounce
    return () => clearTimeout(timeoutId);
  }, [watchedStops, watchedCargo, settings, supabase]);

  useEffect(() => {
    if (isEditMode && existingOrder) {
      form.reset({
        customer_id: existingOrder.customer_id,
        external_order_number: existingOrder.external_order_number || '',
        status: existingOrder.status,
        price: existingOrder.price || undefined,
        description: existingOrder.description || '',
        stops: (existingOrder.freight_order_stops || []).map(s => ({...s, stop_date: s.stop_date || null, time_start: s.time_start || null, time_end: s.time_end || null })),
        cargoItems: existingOrder.cargo_items || [],
        vehicle_id: existingOrder.vehicle_id || undefined,
      });
    }
  }, [existingOrder, isEditMode, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormSchemaType): Promise<FreightOrder> => {
      const { stops, cargoItems, ...orderData } = values;

      const cleanedStops = Array.isArray(stops) ? stops.map((stop: z.infer<typeof stopSchema>) => ({
        ...stop,
        stop_date: stop.stop_date || null,
        time_start: stop.time_start || null,
        time_end: stop.time_end || null,
      })) : [];

      const firstStop = cleanedStops.length > 0 ? cleanedStops[0] : null;
      const lastStop = cleanedStops.length > 0 ? cleanedStops[cleanedStops.length - 1] : null;

      const finalOrderData = {
        ...orderData,
        vehicle_id: orderData.vehicle_id ? Number(orderData.vehicle_id) : null,
        origin_address: firstStop ? firstStop.address : null,
        destination_address: lastStop ? lastStop.address : null,
        pickup_date: firstStop ? firstStop.stop_date : null,
        pickup_time_start: firstStop ? firstStop.time_start : null,
        pickup_time_end: firstStop ? firstStop.time_end : null,
        delivery_date: lastStop ? lastStop.stop_date : null,
        delivery_time_start: lastStop ? lastStop.time_start : null,
        delivery_time_end: lastStop ? lastStop.time_end : null,
        created_by: isEditMode ? existingOrder?.created_by : user?.id,
      };

      Object.keys(finalOrderData).forEach(key => {
        if ((finalOrderData as any)[key] === '') {
          (finalOrderData as any)[key] = null;
        }
      });

      const payload = {
        orderData: finalOrderData,
        stops: cleanedStops,
        cargoItems,
      };

      if (isEditMode) {
        const { data, error } = await supabase.functions.invoke('update-freight-order', { body: { orderId: id, ...payload } });
        if (error) throw error;
        return data.order;
      } else {
        const { data, error } = await supabase.functions.invoke('create-freight-order', { body: payload });
        if (error) throw error;
        return data.order;
      }
    },
    onSuccess: (data) => {
      showSuccess(`Auftrag erfolgreich ${isEditMode ? 'aktualisiert' : 'erstellt'}!`);
      queryClient.invalidateQueries({ queryKey: ['freightOrders'] });
      
      if (!isEditMode) {
        navigate(`/freight-orders/edit/${data.id}`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ['freightOrder', id] });
        queryClient.invalidateQueries({ queryKey: ['orderNotes', Number(id)] });
        queryClient.invalidateQueries({ queryKey: ['orderFiles', Number(id)] });
        queryClient.invalidateQueries({ queryKey: ['orderTeam', Number(id)] });
        queryClient.invalidateQueries({ queryKey: ['orderStatusHistory', Number(id)] });
      }
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.data?.error || `Fehler beim ${isEditMode ? 'Aktualisieren' : 'Erstellen'} des Auftrags.`);
    },
  });

  if (isLoadingCustomers || isLoadingOrder || isLoadingSettings || isLoadingVehicles) {
      return <p>Lade Formulardaten...</p>
  }

  return (
    <>
    <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
      <div className="d-flex align-items-center justify-content-between mb-4">
          <div className='d-flex align-items-center gap-3'>
              <NavLink to="/freight-orders" className="btn btn-outline-secondary btn-sm p-2 lh-1">
                  <ArrowLeft size={16} />
              </NavLink>
              <h1 className="h2 mb-0">
                  {isEditMode ? `Auftrag ${existingOrder?.order_number} bearbeiten` : 'Neuer Frachtauftrag'}
              </h1>
          </div>
          <div className="d-flex align-items-center gap-2">
              {isEditMode && (
                <Button type="button" variant={existingOrder?.is_external ? "secondary" : "outline-secondary"} onClick={() => setIsAssignModalOpen(true)} disabled={isFetchingOrder}>
                  <Share2 className="me-2" size={16} />
                  {isFetchingOrder ? 'Lade...' : (existingOrder?.is_external ? 'Externe Vergabe verwalten' : 'Extern vergeben')}
                </Button>
              )}
              <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Wird gespeichert...' : 'Auftrag speichern'}
              </Button>
          </div>
      </div>

      <Tabs defaultActiveKey="general" id="order-form-tabs" className="mb-3 nav-fill">
        <Tab eventKey="general" title="Allgemein">
          <Row className="g-4">
              <Col lg={8} className="d-flex flex-column gap-4">
                  <Card>
                      <Card.Header className="bg-light">
                          <Card.Title className="d-flex align-items-center">
                              <MapPin className="me-2" size={20} />
                              Route & Stopps
                          </Card.Title>
                          <Card.Text className="text-muted small">Definieren Sie hier die Abhol-, Liefer- und Zwischenstopps.</Card.Text>
                      </Card.Header>
                      <Card.Body className="d-flex flex-column gap-3">
                          {stopFields.map((field, index) => {
                              const stopType = form.watch(`stops.${index}.stop_type`);
                              let borderColorClass = 'border-secondary';
                              if (stopType === 'Abholung') borderColorClass = 'border-primary';
                              if (stopType === 'Lieferung') borderColorClass = 'border-success';
                              if (stopType === 'Teilladung' || stopType === 'Teillieferung') borderColorClass = 'border-warning';

                              return (
                                  <Card key={field.id} className={`position-relative bg-white border-start border-4 ${borderColorClass}`}>
                                      <Card.Body>
                                          <div className="d-flex justify-content-between align-items-center mb-3">
                                              <h6 className="mb-0 fw-bold">Stopp {index + 1}: {stopType}</h6>
                                              <Button type="button" variant="ghost" size="sm" className="p-1" onClick={() => removeStop(index)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                                          </div>
                                          <Row className="g-3">
                                              <Col md={12}><Form.Group><Form.Label>Adresse</Form.Label><Form.Control as="textarea" rows={3} {...form.register(`stops.${index}.address`)} /></Form.Group></Col>
                                              <Col md={6}><Form.Group><Form.Label>Stopp-Art</Form.Label><Form.Select {...form.register(`stops.${index}.stop_type`)}><option value="Abholung">Abholung</option><option value="Teilladung">Teilladung</option><option value="Teillieferung">Teillieferung</option><option value="Lieferung">Lieferung</option></Form.Select></Form.Group></Col>
                                              <Col md={6}><Form.Group><Form.Label>Datum</Form.Label><Form.Control type="date" {...form.register(`stops.${index}.stop_date`)} /></Form.Group></Col>
                                              <Col md={6}><Form.Group><Form.Label>Zeitfenster (von)</Form.Label><Form.Control type="time" {...form.register(`stops.${index}.time_start`)} /></Form.Group></Col>
                                              <Col md={6}><Form.Group><Form.Label>Zeitfenster (bis)</Form.Label><Form.Control type="time" {...form.register(`stops.${index}.time_end`)} /></Form.Group></Col>
                                          </Row>
                                      </Card.Body>
                                  </Card>
                              )
                          })}
                          <Button type="button" variant="outline-secondary" onClick={() => appendStop({ stop_type: 'Teillieferung', address: '', stop_date: null, time_start: null, time_end: null, position: stopFields.length })}>
                              <PlusCircle className="me-2" size={16} /> Stopp hinzufügen
                          </Button>
                      </Card.Body>
                  </Card>
                  <Card>
                      <Card.Header className="bg-light">
                          <Card.Title className="d-flex align-items-center">
                              <Package className="me-2" size={20} />
                              Ladungsdetails
                          </Card.Title>
                          <Card.Text className="text-muted small">Fügen Sie hier die einzelnen Ladungspositionen hinzu.</Card.Text>
                      </Card.Header>
                      <Card.Body className="d-flex flex-column gap-3">
                          {cargoFields.map((field, index) => (
                              <Card key={field.id} className="position-relative bg-white border">
                                  <Card.Body>
                                      <div className="d-flex justify-content-between align-items-center mb-3">
                                          <h6 className="mb-0 fw-bold">Ladungsposition {index + 1}</h6>
                                          <Button type="button" variant="ghost" size="sm" className="p-1" onClick={() => removeCargo(index)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                                      </div>
                                      <Row className="g-3">
                                          <Col xs={6} md={2}><Form.Group><Form.Label>Anzahl</Form.Label><Form.Control type="number" {...form.register(`cargoItems.${index}.quantity`)} /></Form.Group></Col>
                                          <Col xs={6} md={2}><Form.Group><Form.Label>Art</Form.Label><Form.Control {...form.register(`cargoItems.${index}.cargo_type`)} /></Form.Group></Col>
                                          <Col md={4}><Form.Group><Form.Label>Bezeichnung</Form.Label><Form.Control {...form.register(`cargoItems.${index}.description`)} /></Form.Group></Col>
                                          <Col xs={6} md={2}><Form.Group><Form.Label>Gewicht (kg)</Form.Label><Form.Control type="number" step="0.01" {...form.register(`cargoItems.${index}.weight`)} /></Form.Group></Col>
                                          <Col xs={6} md={2}><Form.Group><Form.Label>Lademeter</Form.Label><Form.Control type="number" step="0.01" {...form.register(`cargoItems.${index}.loading_meters`)} /></Form.Group></Col>
                                      </Row>
                                  </Card.Body>
                              </Card>
                          ))}
                          <Button type="button" variant="outline-secondary" onClick={() => appendCargo({ quantity: 1, cargo_type: '', description: '', weight: null, loading_meters: null })}>
                              <PlusCircle className="me-2" size={16} /> Ladungsposition hinzufügen
                          </Button>
                      </Card.Body>
                  </Card>
              </Col>
              <Col lg={4}>
                  <Card>
                      <Card.Header className="bg-light">
                          <Card.Title className="d-flex align-items-center">
                              <Info className="me-2" size={20} />
                              Allgemeine Informationen
                          </Card.Title>
                      </Card.Header>
                      <Card.Body className="d-flex flex-column gap-3">
                          <Form.Group>
                              <Form.Label>Kunde</Form.Label>
                              <Controller
                                name="customer_id"
                                control={form.control}
                                render={({ field }) => (
                                  <CustomerCombobox
                                      customers={customers || []}
                                      value={field.value}
                                      onChange={field.onChange}
                                      onAddNew={() => setIsAddCustomerDialogOpen(true)}
                                  />
                                )}
                              />
                          </Form.Group>
                          <Form.Group><Form.Label>Externe Auftragsnummer</Form.Label><Form.Control {...form.register("external_order_number")} /></Form.Group>
                          <Form.Group><Form.Label>Status</Form.Label><Form.Select {...form.register("status")}><option value="Angelegt">Angelegt</option><option value="Geplant">Geplant</option><option value="Unterwegs">Unterwegs</option><option value="Zugestellt">Zugestellt</option><option value="Storniert">Storniert</option></Form.Select></Form.Group>
                          <Form.Group><Form.Label>Fahrzeug</Form.Label>
                            <Form.Select {...form.register("vehicle_id")} value={form.watch("vehicle_id") ?? ""}>
                                <option value="">- Kein Fahrzeug -</option>
                                {vehicles?.map(v => <option key={v.id} value={v.id}>{v.license_plate} ({v.brand} {v.model})</option>)}
                            </Form.Select>
                          </Form.Group>
                          <Form.Group><Form.Label>Preis (€)</Form.Label><Form.Control type="number" step="0.01" {...form.register("price")} /></Form.Group>
                          <Form.Group><Form.Label>Beschreibung / Notizen</Form.Label><Form.Control as="textarea" {...form.register("description")} /></Form.Group>
                          <hr/>
                          <div className="d-flex flex-column gap-2">
                            <h6 className="text-muted">Routenkalkulation</h6>
                            {isCalculating ? (
                                <div className="d-flex align-items-center gap-2 small text-muted"><Loader2 className="animate-spin" size={16} /> Berechne...</div>
                            ) : routeDetails.distance ? (
                                <>
                                    <div className="d-flex justify-content-between small"><span>Distanz:</span> <strong>~ {routeDetails.distance.toFixed(0)} km</strong></div>
                                    <div className="d-flex justify-content-between small"><span>Geschätzte Kosten:</span> <strong>~ {routeDetails.cost.toFixed(2)} €</strong></div>
                                </>
                            ) : (
                                <p className="small text-muted">Geben Sie Start- und Zieladresse ein, um die Route zu berechnen.</p>
                            )}
                          </div>
                      </Card.Body>
                  </Card>
              </Col>
          </Row>
        </Tab>
        <Tab eventKey="notes" title="Notizen"><NotesTab orderId={id ? Number(id) : null} /></Tab>
        <Tab eventKey="files" title="Dateien"><FilesTab orderId={id ? Number(id) : null} /></Tab>
        <Tab eventKey="team" title="Team"><TeamTab orderId={id ? Number(id) : null} /></Tab>
        <Tab eventKey="history" title="Verlauf" disabled={!isEditMode}><StatusHistoryTab orderId={id ? Number(id) : null} /></Tab>
      </Tabs>
    </Form>
    <AddCustomerDialog
        show={isAddCustomerDialogOpen}
        onHide={() => setIsAddCustomerDialogOpen(false)}
        onCustomerCreated={(newCustomer) => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            form.setValue('customer_id', newCustomer.id);
            setIsAddCustomerDialogOpen(false);
        }}
    />
    <AssignExternalOrderDialog
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        order={existingOrder || null}
        settings={settings}
    />
    </>
  );
};

export default FreightOrderForm;