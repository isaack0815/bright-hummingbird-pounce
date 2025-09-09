import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, Card, Form, Tabs, Tab, Row, Col } from 'react-bootstrap';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useError } from '@/contexts/ErrorContext';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Vehicle, VehicleGroup } from '@/types/vehicle';
import type { ChatUser } from '@/types/chat';
import VehicleNotesTab from '@/components/vehicle/VehicleNotesTab';

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
  max_payload_kg: z.coerce.number().optional(),
  next_service_date: z.string().optional(),
  gas_inspection_due_date: z.string().optional(),
  driver_id: z.string().uuid().nullable().optional(),
  group_id: z.coerce.number().nullable().optional(),
  verizon_vehicle_id: z.string().optional(),
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

const fetchVehicleGroups = async (): Promise<VehicleGroup[]> => {
    const { data, error } = await supabase.functions.invoke('get-vehicle-groups');
    if (error) throw new Error(error.message);
    return data.groups;
};

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

  const { data: vehicleGroups, isLoading: isLoadingGroups } = useQuery<VehicleGroup[]>({
    queryKey: ['vehicleGroups'],
    queryFn: fetchVehicleGroups,
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
      group_id: null,
      verizon_vehicle_id: "",
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
        max_payload_kg: existingVehicle.max_payload_kg || undefined,
        next_service_date: existingVehicle.next_service_date || "",
        gas_inspection_due_date: existingVehicle.gas_inspection_due_date || "",
        driver_id: existingVehicle.driver_id || null,
        group_id: existingVehicle.group_id || null,
        verizon_vehicle_id: (existingVehicle as any).verizon_vehicle_id || "",
      });
    }
  }, [existingVehicle, isEditMode, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>): Promise<Vehicle> => {
      const payload = { ...values, driver_id: values.driver_id || null, group_id: values.group_id || null };
      
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

  if (isLoadingUsers || isLoadingVehicle || isLoadingGroups) {
      return <p>Lade Formulardaten...</p>
  }

  return (
    <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
      <div className="d-flex align-items-center justify-content-between mb-4">
          <div className='d-flex align-items-center gap-4'>
              <NavLink to="/vehicles" className="btn btn-outline-secondary p-2 lh-1"><ArrowLeft size={16} /></NavLink>
              <h1 className="h2 mb-0">
                  {isEditMode ? `Fahrzeug ${existingVehicle?.license_plate} bearbeiten` : 'Neues Fahrzeug'}
              </h1>
          </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Wird gespeichert...' : 'Fahrzeug speichern'}
        </Button>
      </div>

      <Tabs defaultActiveKey="general" className="mb-3 nav-fill">
        <Tab eventKey="general" title="Allgemein">
          <Card>
            <Card.Header>
              <Card.Title>Fahrzeugdetails</Card.Title>
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                  <Col md={6}><Form.Group><Form.Label>Kennzeichen</Form.Label><Form.Control {...form.register("license_plate")} isInvalid={!!form.formState.errors.license_plate} /><Form.Control.Feedback type="invalid">{form.formState.errors.license_plate?.message}</Form.Control.Feedback></Form.Group></Col>
                  <Col md={6}><Form.Group><Form.Label>Verizon Vehicle ID</Form.Label><Form.Control {...form.register("verizon_vehicle_id")} placeholder="z.B. TFG-123" /></Form.Group></Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Fahrer</Form.Label>
                      <Form.Select {...form.register("driver_id")} value={form.watch("driver_id") ?? "none"} disabled={isLoadingUsers}>
                        <option value="none">- Kein Fahrer -</option>
                        {users?.map((user) => (
                          <option key={user.id} value={user.id}>
                            {`${user.first_name || ''} ${user.last_name || ''}`.trim()}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Fahrzeuggruppe</Form.Label>
                      <Form.Select {...form.register("group_id")} value={form.watch("group_id") ?? "none"} disabled={isLoadingGroups}>
                        <option value="none">- Keine Gruppe -</option>
                        {vehicleGroups?.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}><Form.Group><Form.Label>Marke</Form.Label><Form.Control {...form.register("brand")} /></Form.Group></Col>
                  <Col md={6}><Form.Group><Form.Label>Modell</Form.Label><Form.Control {...form.register("model")} /></Form.Group></Col>
                  <Col md={6}><Form.Group><Form.Label>Fahrzeugtyp</Form.Label><Form.Select {...form.register("type")}><option value="Sattelzugmaschine">Sattelzugmaschine</option><option value="Anhänger">Anhänger</option><option value="Transporter">Transporter</option><option value="LKW">LKW</option><option value="PKW">PKW</option></Form.Select></Form.Group></Col>
                  <Col md={6}><Form.Group><Form.Label>Fahrgestellnummer (VIN)</Form.Label><Form.Control {...form.register("vin")} /></Form.Group></Col>
                  <Col md={4}><Form.Group><Form.Label>Baujahr</Form.Label><Form.Control type="number" {...form.register("year_of_manufacture")} /></Form.Group></Col>
                  <Col md={4}><Form.Group><Form.Label>Ladefläche (m²)</Form.Label><Form.Control type="number" step="0.01" {...form.register("loading_area")} /></Form.Group></Col>
                  <Col md={4}><Form.Group><Form.Label>Zuladung (kg)</Form.Label><Form.Control type="number" step="0.01" {...form.register("max_payload_kg")} /></Form.Group></Col>
                  <Col md={6}><Form.Group><Form.Label>Nächste HU</Form.Label><Form.Control type="date" {...form.register("inspection_due_date")} /></Form.Group></Col>
                  <Col md={6}><Form.Group><Form.Label>Nächster Service</Form.Label><Form.Control type="date" {...form.register("next_service_date")} /></Form.Group></Col>
                  <Col md={6}><Form.Group><Form.Label>Nächste Gasdurchsicht</Form.Label><Form.Control type="date" {...form.register("gas_inspection_due_date")} /></Form.Group></Col>
                  <Col md={6}><Form.Group><Form.Label>Status</Form.Label><Form.Select {...form.register("status")}><option value="Verfügbar">Verfügbar</option><option value="In Reparatur">In Reparatur</option><option value="Unterwegs">Unterwegs</option><option value="Außer Betrieb">Außer Betrieb</option></Form.Select></Form.Group></Col>
                  <Col md={12}><Form.Group><Form.Label>Notizen</Form.Label><Form.Control as="textarea" {...form.register("notes")} /></Form.Group></Col>
              </Row>
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="notes" title="Notizen" disabled={!isEditMode}>
          <VehicleNotesTab vehicleId={id ? Number(id) : null} />
        </Tab>
        <Tab eventKey="files" title="Dateien (bald)" disabled>
          {/* Placeholder for future files component */}
        </Tab>
      </Tabs>
    </Form>
  );
};

export default VehicleForm;