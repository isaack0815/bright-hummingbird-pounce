import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Card, Form, Spinner, Placeholder, Alert, Modal } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Terminal, Wifi, CheckCircle2, XCircle } from "lucide-react";
import type { Setting } from "@/types/settings";
import type { VehicleGroup } from "@/types/vehicle";

const settingsSchema = z.object({
  company_name: z.string().optional(),
  company_address: z.string().optional(),
  company_city_zip: z.string().optional(),
  company_country: z.string().optional(),
  company_tax_id: z.string().optional(),
  email_signature: z.string().optional(),
  email_bcc: z.string().email({ message: "Ungültige E-Mail-Adresse." }).optional().or(z.literal('')),
  payment_term_default: z.coerce.number().optional(),
  agb_text: z.string().optional(),
  tour_planning_vehicle_group_id: z.coerce.number().optional(),
});

const fetchSettings = async (): Promise<Setting[]> => {
  const { data, error } = await supabase.functions.invoke('get-settings');
  if (error) throw new Error(error.message);
  return data.settings;
};

const fetchSmtpStatus = async (): Promise<Record<string, boolean>> => {
  const { data, error } = await supabase.functions.invoke('get-smtp-secrets-status');
  if (error) throw error;
  return data.status;
};

const fetchVehicleGroups = async (): Promise<VehicleGroup[]> => {
    const { data, error } = await supabase.functions.invoke('get-vehicle-groups');
    if (error) throw new Error(error.message);
    return data.groups;
};

const Settings = () => {
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; steps: string[] } | null>(null);

  const { data: settings, isLoading } = useQuery<Setting[]>({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const { data: smtpStatus, isLoading: isLoadingSmtpStatus } = useQuery<Record<string, boolean>>({
    queryKey: ['smtpStatus'],
    queryFn: fetchSmtpStatus,
  });

  const { data: vehicleGroups, isLoading: isLoadingVehicleGroups } = useQuery<VehicleGroup[]>({
    queryKey: ['vehicleGroups'],
    queryFn: fetchVehicleGroups,
  });

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      company_name: "",
      company_address: "",
      company_city_zip: "",
      company_country: "",
      company_tax_id: "",
      email_signature: "",
      email_bcc: "",
      payment_term_default: 45,
      agb_text: "",
      tour_planning_vehicle_group_id: undefined,
    },
  });

  useEffect(() => {
    if (settings) {
      const settingsMap = new Map(settings.map(s => [s.key, s.value]));
      form.reset({
        company_name: settingsMap.get('company_name') || "",
        company_address: settingsMap.get('company_address') || "",
        company_city_zip: settingsMap.get('company_city_zip') || "",
        company_country: settingsMap.get('company_country') || "",
        company_tax_id: settingsMap.get('company_tax_id') || "",
        email_signature: settingsMap.get('email_signature') || "",
        email_bcc: settingsMap.get('email_bcc') || "",
        payment_term_default: Number(settingsMap.get('payment_term_default')) || 45,
        agb_text: settingsMap.get('agb_text') || "",
        tour_planning_vehicle_group_id: Number(settingsMap.get('tour_planning_vehicle_group_id')) || undefined,
      });
    }
  }, [settings, form]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (values: z.infer<typeof settingsSchema>) => {
      const settingsToUpdate = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }));
      const { data, error } = await supabase.functions.invoke('update-settings', {
        body: settingsToUpdate,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess("Einstellungen erfolgreich gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Speichern der Einstellungen.");
    },
  });

  const testSmtpMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-smtp-connection');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (typeof data === 'object' && data !== null) {
        setTestResult({
          success: data.success,
          message: data.success ? data.message : (data.error || "Ein unbekannter Fehler ist aufgetreten."),
          steps: data.steps || [],
        });
      } else {
        setTestResult({
          success: false,
          message: "Unerwartetes Antwortformat vom Server erhalten.",
          steps: [`Antwort: ${JSON.stringify(data)}`],
        });
      }
    },
    onError: (err: any) => {
      setTestResult({
        success: false,
        message: err.data?.error || err.message || "Aufruf der Edge-Funktion fehlgeschlagen. CORS-Fehler in der Browser-Konsole prüfen.",
        steps: [],
      });
    },
  });

  const onSubmit = (values: z.infer<typeof settingsSchema>) => {
    updateSettingsMutation.mutate(values);
  };

  const SecretStatusItem = ({ name, isSet }: { name: string, isSet: boolean | undefined }) => (
    <li className="d-flex align-items-center justify-content-between small py-1 border-bottom">
      <span className="font-monospace text-muted">{name}</span>
      {isSet === undefined ? (
        <Placeholder animation="glow"><Placeholder xs={1} size="sm" style={{width: '20px', height: '20px', borderRadius: '50%'}} /></Placeholder>
      ) : isSet ? (
        <CheckCircle2 className="text-success" size={20} />
      ) : (
        <XCircle className="text-danger" size={20} />
      )}
    </li>
  );

  return (
    <>
      <div className="mb-4">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h1 className="h2">Einstellungen</h1>
          <Button form="settings-form" type="submit" disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending ? <Spinner as="span" animation="border" size="sm" /> : "Alle Einstellungen speichern"}
          </Button>
        </div>

        <Form id="settings-form" onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="mb-4">
            <Card.Header>
              <Card.Title>Firmendaten</Card.Title>
              <Card.Text className="text-muted">Diese Daten werden für den PDF-Export verwendet.</Card.Text>
            </Card.Header>
            <Card.Body>
              {isLoading ? <Placeholder as="div" animation="glow"><Placeholder xs={12} style={{height: '200px'}} /></Placeholder> : (
                <>
                  <Form.Group className="mb-3"><Form.Label>Firmenname</Form.Label><Form.Control {...form.register("company_name")} /></Form.Group>
                  <Form.Group className="mb-3"><Form.Label>Straße & Hausnummer</Form.Label><Form.Control {...form.register("company_address")} /></Form.Group>
                  <Form.Group className="mb-3"><Form.Label>PLZ & Ort</Form.Label><Form.Control {...form.register("company_city_zip")} /></Form.Group>
                  <Form.Group className="mb-3"><Form.Label>Land</Form.Label><Form.Control {...form.register("company_country")} /></Form.Group>
                  <Form.Group><Form.Label>Umsatzsteuer-ID</Form.Label><Form.Control {...form.register("company_tax_id")} /></Form.Group>
                </>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>
              <Card.Title>Globale Auftragseinstellungen</Card.Title>
              <Card.Text className="text-muted">Systemweite Standardwerte und Konfigurationen.</Card.Text>
            </Card.Header>
            <Card.Body>
              {isLoading ? <Placeholder as="div" animation="glow"><Placeholder xs={6} /></Placeholder> : (
                <Form.Group><Form.Label>Standard-Zahlungsfrist (Tage)</Form.Label><Form.Control type="number" {...form.register("payment_term_default")} /></Form.Group>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>
              <Card.Title>Tourenplanung</Card.Title>
              <Card.Text className="text-muted">Einstellungen für die Tourenverwaltung.</Card.Text>
            </Card.Header>
            <Card.Body>
              {isLoading || isLoadingVehicleGroups ? <Placeholder as="div" animation="glow"><Placeholder xs={6} /></Placeholder> : (
                <Form.Group>
                  <Form.Label>Standard-Fahrzeuggruppe für Touren</Form.Label>
                  <Form.Select {...form.register("tour_planning_vehicle_group_id")}>
                    <option value="">Alle Fahrzeuge</option>
                    {vehicleGroups?.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>
              <Card.Title>AGB für PDF-Export</Card.Title>
              <Card.Text className="text-muted">Dieser Text wird auf den generierten Transportaufträgen als AGB gedruckt.</Card.Text>
            </Card.Header>
            <Card.Body>
              {isLoading ? <Placeholder as="div" animation="glow"><Placeholder xs={12} style={{height: '200px'}} /></Placeholder> : (
                <Form.Group>
                  <Form.Label>AGB Text</Form.Label>
                  <Form.Control as="textarea" rows={10} className="font-monospace small" {...form.register("agb_text")} />
                </Form.Group>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>E-Mail Konfiguration</Card.Title>
              <Card.Text className="text-muted">Allgemeine Einstellungen für den E-Mail-Versand.</Card.Text>
            </Card.Header>
            <Card.Body>
              <Alert variant="info">
                <div className="d-flex align-items-start">
                  <Terminal className="me-3 mt-1" size={20} />
                  <div>
                    <Alert.Heading as="h5">Wichtiger Hinweis!</Alert.Heading>
                    <p className="mb-0">
                      Die SMTP-Zugangsdaten müssen als Secrets direkt in Ihrem Supabase-Projekt hinterlegt werden. Fügen Sie auch `SMTP_SECURE` mit dem Wert `tls`, `ssl` oder `none` hinzu.
                    </p>
                  </div>
                </div>
              </Alert>

              <div className="row g-4 mt-3">
                <div className="col-md-6">
                  <div className="border p-3 rounded h-100">
                    <h4 className="h6">Status der SMTP-Secrets</h4>
                    {isLoadingSmtpStatus ? <Placeholder as="div" animation="glow"><Placeholder xs={12} style={{height: '150px'}} /></Placeholder> : (
                      <ul className="list-unstyled mb-0">
                        <SecretStatusItem name="SMTP_HOST" isSet={smtpStatus?.SMTP_HOST} />
                        <SecretStatusItem name="SMTP_PORT" isSet={smtpStatus?.SMTP_PORT} />
                        <SecretStatusItem name="SMTP_USER" isSet={smtpStatus?.SMTP_USER} />
                        <SecretStatusItem name="SMTP_PASS" isSet={smtpStatus?.SMTP_PASS} />
                        <SecretStatusItem name="SMTP_FROM_EMAIL" isSet={smtpStatus?.SMTP_FROM_EMAIL} />
                        <SecretStatusItem name="SMTP_SECURE" isSet={smtpStatus?.SMTP_SECURE} />
                      </ul>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border p-3 rounded h-100">
                    <h4 className="h6">SMTP-Verbindung testen</h4>
                    <p className="small text-muted">
                      Prüfen Sie, ob die in den Secrets hinterlegten Daten korrekt sind.
                    </p>
                    <Button 
                      type="button" 
                      variant="outline-secondary" 
                      onClick={() => testSmtpMutation.mutate()}
                      disabled={testSmtpMutation.isPending}
                    >
                      <Wifi className="me-2" size={16} />
                      {testSmtpMutation.isPending ? 'Teste Verbindung...' : 'Verbindung testen'}
                    </Button>
                  </div>
                </div>
              </div>

              {isLoading ? <div className="mt-4"><Placeholder as="div" animation="glow"><Placeholder xs={12} style={{height: '150px'}} /></Placeholder></div> : (
                <div className="mt-4">
                  <Form.Group className="mb-3"><Form.Label>BCC-Empfänger</Form.Label><Form.Control type="email" placeholder="bcc@example.com" {...form.register("email_bcc")} /></Form.Group>
                  <Form.Group><Form.Label>Standard-Signatur (HTML)</Form.Label><Form.Control as="textarea" rows={5} placeholder="<p>Mit freundlichen Grüßen</p>" className="font-monospace" {...form.register("email_signature")} /></Form.Group>
                </div>
              )}
            </Card.Body>
          </Card>
        </Form>
      </div>

      <Modal show={!!testResult} onHide={() => setTestResult(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Ergebnis des SMTP-Tests</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant={testResult?.success ? 'success' : 'danger'}>
            {testResult?.message}
          </Alert>
          <div className="small bg-dark text-white font-monospace p-3 rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <h5 className="h6">Protokoll:</h5>
            <ul className="list-unstyled mb-0">
              {testResult?.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
            {testResult && testResult.steps.length === 0 && (
              <p className="text-muted">Keine Protokolldaten empfangen.</p>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setTestResult(null)}>Schließen</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Settings;