import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Card, Form, Spinner, Placeholder, Alert, Modal, Tabs, Tab, Row, Col } from "react-bootstrap";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Terminal, Wifi, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
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

const Settings = () => {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; steps: string[] } | null>(null);

  const { data: settings, isLoading } = useQuery<Setting[]>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-settings');
      if (error) throw new Error(error.message);
      return data.settings;
    },
  });

  const { data: emailSecretsStatus, isLoading: isLoadingEmailSecrets } = useQuery<Record<string, boolean>>({
    queryKey: ['emailSecretsStatus'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-email-secrets-status');
      if (error) throw error;
      return data.status;
    },
  });

  const { data: vehicleGroups, isLoading: isLoadingVehicleGroups } = useQuery<VehicleGroup[]>({
    queryKey: ['vehicleGroups'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-vehicle-groups');
      if (error) throw new Error(error.message);
      return data.groups;
    },
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

  const syncAllEmailsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cron-sync-emails');
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      showSuccess(data.message || "E-Mail-Synchronisation für alle Konten wurde erfolgreich angestoßen.");
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Anstoßen der E-Mail-Synchronisation.");
    },
  });

  const testSingleEmailSyncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-single-email-sync');
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      showSuccess(data.message || "Test-Synchronisation erfolgreich abgeschlossen.");
    },
    onError: (err: any) => {
      showError(err.data?.error || err.message || "Fehler bei der Test-Synchronisation.");
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
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h2">Einstellungen</h1>
        <Button form="settings-form" type="submit" disabled={updateSettingsMutation.isPending}>
          {updateSettingsMutation.isPending ? <Spinner as="span" animation="border" size="sm" /> : "Alle Einstellungen speichern"}
        </Button>
      </div>

      <Form id="settings-form" onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs defaultActiveKey="general" id="settings-tabs" className="mb-3 nav-fill">
          <Tab eventKey="general" title="Allgemein">
            <Card className="mb-4">
              <Card.Header>
                <Card.Title>Firmendaten</Card.Title>
                <Card.Text className="text-muted">Diese Daten werden für den PDF-Export verwendet.</Card.Text>
              </Card.Header>
              <Card.Body>
                {isLoading ? <Placeholder as="div" animation="glow"><Placeholder xs={12} style={{height: '200px'}} /></Placeholder> : (
                  <Row className="g-3">
                    <Col md={12}><Form.Group><Form.Label>Firmenname</Form.Label><Form.Control {...form.register("company_name")} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Straße & Hausnummer</Form.Label><Form.Control {...form.register("company_address")} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>PLZ & Ort</Form.Label><Form.Control {...form.register("company_city_zip")} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Land</Form.Label><Form.Control {...form.register("company_country")} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Umsatzsteuer-ID</Form.Label><Form.Control {...form.register("company_tax_id")} /></Form.Group></Col>
                  </Row>
                )}
              </Card.Body>
            </Card>
          </Tab>
          <Tab eventKey="orders" title="Aufträge & Touren">
            <Card className="mb-4">
              <Card.Header>
                <Card.Title>Globale Auftragseinstellungen</Card.Title>
                <Card.Text className="text-muted">Systemweite Standardwerte und Konfigurationen.</Card.Text>
              </Card.Header>
              <Card.Body>
                {isLoading ? <Placeholder as="div" animation="glow"><Placeholder xs={6} /></Placeholder> : (
                  <Row>
                    <Col md={6}>
                      <Form.Group><Form.Label>Standard-Zahlungsfrist (Tage)</Form.Label><Form.Control type="number" {...form.register("payment_term_default")} /></Form.Group>
                    </Col>
                  </Row>
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
                  <Row>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Standard-Fahrzeuggruppe für Touren</Form.Label>
                        <Form.Select {...form.register("tour_planning_vehicle_group_id")}>
                          <option value="">Alle Fahrzeuge</option>
                          {vehicleGroups?.map(group => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                )}
              </Card.Body>
            </Card>
          </Tab>
          <Tab eventKey="documents" title="Dokumente & E-Mail">
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
            <Card className="mb-4">
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
                        Die Zugangsdaten müssen als Secrets direkt in Ihrem Supabase-Projekt hinterlegt werden.
                      </p>
                    </div>
                  </div>
                </Alert>
                <div className="row g-4 mt-3">
                  <div className="col-md-6">
                    <div className="border p-3 rounded h-100">
                      <h4 className="h6">Status der E-Mail-Secrets</h4>
                      {isLoadingEmailSecrets ? <Placeholder as="div" animation="glow"><Placeholder xs={12} style={{height: '150px'}} /></Placeholder> : (
                        <ul className="list-unstyled mb-0">
                          <SecretStatusItem name="IMAP_HOST" isSet={emailSecretsStatus?.IMAP_HOST} />
                          <SecretStatusItem name="SMTP_HOST" isSet={emailSecretsStatus?.SMTP_HOST} />
                          <SecretStatusItem name="SMTP_PORT" isSet={emailSecretsStatus?.SMTP_PORT} />
                          <SecretStatusItem name="SMTP_USER" isSet={emailSecretsStatus?.SMTP_USER} />
                          <SecretStatusItem name="SMTP_PASS" isSet={emailSecretsStatus?.SMTP_PASS} />
                          <SecretStatusItem name="SMTP_FROM_EMAIL" isSet={emailSecretsStatus?.SMTP_FROM_EMAIL} />
                          <SecretStatusItem name="SMTP_SECURE" isSet={emailSecretsStatus?.SMTP_SECURE} />
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="border p-3 rounded h-100">
                      <h4 className="h6">SMTP-Verbindung testen</h4>
                      <p className="small text-muted">
                        Prüfen Sie, ob die in den Secrets hinterlegten Daten für den E-Mail-Versand korrekt sind.
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
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3"><Form.Label>BCC-Empfänger</Form.Label><Form.Control type="email" placeholder="bcc@example.com" {...form.register("email_bcc")} /></Form.Group>
                      </Col>
                    </Row>
                    <Form.Group><Form.Label>Standard-Signatur (HTML)</Form.Label><Form.Control as="textarea" rows={5} placeholder="<p>Mit freundlichen Grüßen</p>" className="font-monospace" {...form.register("email_signature")} /></Form.Group>
                  </div>
                )}
              </Card.Body>
            </Card>
            <Card className="mt-4">
              <Card.Header>
                <Card.Title>Manuelle System-Aktionen</Card.Title>
                <Card.Text className="text-muted">Diese Aktionen werden normalerweise automatisch ausgeführt.</Card.Text>
              </Card.Header>
              <Card.Body>
                <h4 className="h6">E-Mail-Synchronisation (Produktiv)</h4>
                <p className="small text-muted">
                  Starten Sie manuell die Synchronisation aller konfigurierten E-Mail-Konten. Dies kann einige Minuten dauern.
                </p>
                <Button 
                  type="button" 
                  variant="outline-secondary" 
                  onClick={() => syncAllEmailsMutation.mutate()}
                  disabled={syncAllEmailsMutation.isPending}
                >
                  <RefreshCw className="me-2" size={16} />
                  {syncAllEmailsMutation.isPending ? <><Spinner as="span" size="sm" className="me-2" />Wird synchronisiert...</> : "Alle E-Mails jetzt synchronisieren"}
                </Button>
                <hr className="my-4" />
                <h4 className="h6">Einzel-Konto Test-Synchronisation (ChatGPT-Skript)</h4>
                <p className="small text-muted">
                  Führt eine einmalige Synchronisation für das in den Secrets (`IMAP_USER`, `IMAP_PASS`) hinterlegte Konto durch. Läuft bei vielen E-Mails eventuell in einen Timeout.
                </p>
                <Button 
                  type="button" 
                  variant="outline-danger" 
                  onClick={() => testSingleEmailSyncMutation.mutate()}
                  disabled={testSingleEmailSyncMutation.isPending}
                >
                  <Terminal className="me-2" size={16} />
                  {testSingleEmailSyncMutation.isPending ? <><Spinner as="span" size="sm" className="me-2" />Teste...</> : "Test-Sync starten"}
                </Button>
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>
      </Form>

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