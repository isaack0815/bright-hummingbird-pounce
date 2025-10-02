import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Card, Form, Spinner, Placeholder, Alert, Modal, Tabs, Tab, Row, Col, InputGroup } from "react-bootstrap";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Terminal, Wifi, CheckCircle2, XCircle, RefreshCw, GitPullRequest, AlertCircle } from "lucide-react";
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
  price_per_km_small: z.coerce.number().optional(),
  price_per_km_large: z.coerce.number().optional(),
  weight_limit_small_kg: z.coerce.number().optional(),
  loading_meters_limit_small: z.coerce.number().optional(),
});

const Settings = () => {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; steps: string[] } | null>(null);
  const [updateStatus, setUpdateStatus] = useState<{ updateAvailable: boolean, statusText: string } | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);

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
      price_per_km_small: 0.9,
      price_per_km_large: 1.8,
      weight_limit_small_kg: 1000,
      loading_meters_limit_small: 4.5,
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
        price_per_km_small: Number(settingsMap.get('price_per_km_small')) || 0.9,
        price_per_km_large: Number(settingsMap.get('price_per_km_large')) || 1.8,
        weight_limit_small_kg: Number(settingsMap.get('weight_limit_small_kg')) || 1000,
        loading_meters_limit_small: Number(settingsMap.get('loading_meters_limit_small')) || 4.5,
      });
    }
  }, [settings, form]);

  const handleCheckForUpdates = async () => {
    setIsCheckingForUpdates(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-for-updates');
      if (error) throw error;
      setUpdateStatus(data);
    } catch (err: any) {
      showError(err.message || "Fehler bei der Update-Prüfung.");
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  useEffect(() => {
    handleCheckForUpdates();
  }, []);

  const handleRunUpdate = async () => {
    setIsUpdating(true);
    setUpdateLog([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Nicht authentifiziert.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-update`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      if (!response.body) throw new Error("Kein Response Body für Streaming erhalten.");

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const lines = value.split('\n\n').filter(line => line.startsWith('data: '));
        for (const line of lines) {
          const json = line.replace('data: ', '');
          try {
            const chunk = JSON.parse(json);
            if (chunk === "---SUCCESS---") {
              showSuccess("Update erfolgreich abgeschlossen!");
              handleCheckForUpdates();
            } else if (chunk === "---ERROR---") {
              showError("Update mit Fehlern beendet. Bitte Log prüfen.");
            } else {
              setUpdateLog(prev => [...prev, chunk]);
            }
          } catch (e) {
            console.error("Fehler beim Parsen des Stream-Chunks:", json);
          }
        }
      }
    } catch (err: any) {
      showError(err.message || "Fehler beim Starten des Updates.");
      setUpdateLog(prev => [...prev, `FEHLER: ${err.message}`]);
    } finally {
      setIsUpdating(false);
    }
  };

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
            {/* ... existing general tab content ... */}
          </Tab>
          <Tab eventKey="orders" title="Aufträge & Touren">
            {/* ... existing orders tab content ... */}
          </Tab>
          <Tab eventKey="documents" title="Dokumente & E-Mail">
            {/* ... existing documents tab content ... */}
          </Tab>
          <Tab eventKey="system" title="System">
            <Card>
              <Card.Header>
                <Card.Title>Anwendungs-Update</Card.Title>
                <Card.Text className="text-muted">Verwalten Sie hier die Updates Ihrer Anwendung.</Card.Text>
              </Card.Header>
              <Card.Body>
                <div className="d-flex align-items-center gap-4">
                  <div>
                    {isCheckingForUpdates ? <Spinner size="sm" /> : updateStatus?.updateAvailable ? (
                      <AlertCircle className="text-warning" size={32} />
                    ) : (
                      <CheckCircle2 className="text-success" size={32} />
                    )}
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-0">
                      {isCheckingForUpdates ? 'Prüfe auf Updates...' : updateStatus?.updateAvailable ? 'Ein Update ist verfügbar' : 'Ihre Anwendung ist auf dem neuesten Stand'}
                    </h6>
                    <p className="small text-muted mb-0">
                      {isCheckingForUpdates ? 'Bitte warten...' : updateStatus?.statusText.split('\n')[0]}
                    </p>
                  </div>
                  <div className="d-flex gap-2">
                    <Button variant="outline-secondary" onClick={handleCheckForUpdates} disabled={isCheckingForUpdates || isUpdating}>
                      <RefreshCw size={16} className={isCheckingForUpdates ? 'animate-spin' : ''} />
                    </Button>
                    <Button onClick={handleRunUpdate} disabled={!updateStatus?.updateAvailable || isUpdating || isCheckingForUpdates}>
                      <GitPullRequest size={16} className="me-2" />
                      {isUpdating ? 'Update läuft...' : 'Jetzt updaten'}
                    </Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>
      </Form>

      <Modal show={!!testResult} onHide={() => setTestResult(null)}>
        {/* ... existing SMTP test modal ... */}
      </Modal>

      <Modal show={isUpdating} onHide={() => {}} backdrop="static" keyboard={false}>
        <Modal.Header>
          <Modal.Title>Update-Prozess</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <pre className="bg-dark text-white font-monospace p-3 rounded" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <code>
              {updateLog.join('')}
            </code>
          </pre>
        </Modal.Body>
        <Modal.Footer>
          <p className="text-muted small">Bitte schließen Sie dieses Fenster nicht, bis der Prozess abgeschlossen ist.</p>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Settings;