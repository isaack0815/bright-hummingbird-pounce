import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Wifi, CheckCircle2, XCircle } from "lucide-react";
import type { Setting } from "@/types/settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
      });
    }
  }, [settings, form]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (values: z.infer<typeof settingsSchema>) => {
      const settingsToUpdate = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }));
      const { error } = await supabase.functions.invoke('update-settings', {
        body: settingsToUpdate,
      });
      if (error) throw error;
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
      setTestResult({
        success: data.success,
        message: data.success ? data.message : data.error,
        steps: data.steps || [],
      });
    },
    onError: (err: any) => {
      setTestResult({
        success: false,
        message: err.message || "Failed to invoke Edge Function. Check browser console for CORS errors.",
        steps: [],
      });
    },
  });

  const onSubmit = (values: z.infer<typeof settingsSchema>) => {
    updateSettingsMutation.mutate(values);
  };

  const SecretStatusItem = ({ name, isSet }: { name: string, isSet: boolean | undefined }) => (
    <li className="flex items-center justify-between text-sm py-1 border-b">
      <span className="font-mono text-muted-foreground">{name}</span>
      {isSet === undefined ? (
        <Skeleton className="h-5 w-5 rounded-full" />
      ) : isSet ? (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      ) : (
        <XCircle className="h-5 w-5 text-destructive" />
      )}
    </li>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Einstellungen</h1>
          <Button form="settings-form" type="submit" disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending ? "Wird gespeichert..." : "Alle Einstellungen speichern"}
          </Button>
        </div>

        <Form {...form}>
          <form id="settings-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Firmendaten</CardTitle>
                <CardDescription>Diese Daten werden für den PDF-Export verwendet.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? <Skeleton className="h-40 w-full" /> : (
                  <>
                    <FormField control={form.control} name="company_name" render={({ field }) => (
                      <FormItem><FormLabel>Firmenname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="company_address" render={({ field }) => (
                      <FormItem><FormLabel>Straße & Hausnummer</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="company_city_zip" render={({ field }) => (
                      <FormItem><FormLabel>PLZ & Ort</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="company_country" render={({ field }) => (
                      <FormItem><FormLabel>Land</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="company_tax_id" render={({ field }) => (
                      <FormItem><FormLabel>Umsatzsteuer-ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Globale Auftragseinstellungen</CardTitle>
                <CardDescription>Systemweite Standardwerte und Konfigurationen.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-10 w-full" /> : (
                  <FormField control={form.control} name="payment_term_default" render={({ field }) => (
                    <FormItem><FormLabel>Standard-Zahlungsfrist (Tage)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AGB für PDF-Export</CardTitle>
                <CardDescription>Dieser Text wird auf den generierten Transportaufträgen als AGB gedruckt.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-40 w-full" /> : (
                  <FormField
                    control={form.control}
                    name="agb_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AGB Text</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Geben Sie hier Ihre AGB ein..."
                            className="min-h-[300px] font-mono text-xs"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>E-Mail Konfiguration</CardTitle>
                <CardDescription>Allgemeine Einstellungen für den E-Mail-Versand.</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Wichtiger Hinweis!</AlertTitle>
                  <AlertDescription>
                    Die SMTP-Zugangsdaten müssen als Secrets direkt in Ihrem Supabase-Projekt hinterlegt werden. Fügen Sie auch `SMTP_SECURE` mit dem Wert `tls`, `ssl` oder `none` hinzu.
                  </AlertDescription>
                </Alert>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="border p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold">Status der SMTP-Secrets</h4>
                    {isLoadingSmtpStatus ? (
                      <Skeleton className="h-36 w-full" />
                    ) : (
                      <ul className="space-y-1">
                        <SecretStatusItem name="SMTP_HOST" isSet={smtpStatus?.SMTP_HOST} />
                        <SecretStatusItem name="SMTP_PORT" isSet={smtpStatus?.SMTP_PORT} />
                        <SecretStatusItem name="SMTP_USER" isSet={smtpStatus?.SMTP_USER} />
                        <SecretStatusItem name="SMTP_PASS" isSet={smtpStatus?.SMTP_PASS} />
                        <SecretStatusItem name="SMTP_FROM_EMAIL" isSet={smtpStatus?.SMTP_FROM_EMAIL} />
                        <SecretStatusItem name="SMTP_SECURE" isSet={smtpStatus?.SMTP_SECURE} />
                      </ul>
                    )}
                  </div>
                  <div className="border p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold">SMTP-Verbindung testen</h4>
                    <p className="text-sm text-muted-foreground">
                      Prüfen Sie, ob die in den Secrets hinterlegten Daten korrekt sind.
                    </p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => testSmtpMutation.mutate()}
                      disabled={testSmtpMutation.isPending}
                    >
                      <Wifi className="mr-2 h-4 w-4" />
                      {testSmtpMutation.isPending ? 'Teste Verbindung...' : 'Verbindung testen'}
                    </Button>
                  </div>
                </div>

                {isLoading ? <div className="space-y-4 mt-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div> : (
                  <div className="space-y-4 mt-6">
                    <FormField control={form.control} name="email_bcc" render={({ field }) => (
                      <FormItem><FormLabel>BCC-Empfänger</FormLabel><FormControl><Input placeholder="bcc@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email_signature" render={({ field }) => (
                      <FormItem><FormLabel>Standard-Signatur (HTML)</FormLabel><FormControl><Textarea placeholder="<p>Mit freundlichen Grüßen</p>" className="min-h-[150px] font-mono" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>

      <AlertDialog open={!!testResult} onOpenChange={() => setTestResult(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ergebnis des SMTP-Tests</AlertDialogTitle>
            <AlertDialogDescription className={testResult?.success ? 'text-green-600' : 'text-destructive'}>
              {testResult?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm bg-muted p-3 rounded-md max-h-60 overflow-y-auto">
            <h4 className="font-semibold mb-2">Protokoll:</h4>
            <ul className="space-y-1">
              {testResult?.steps.map((step, index) => (
                <li key={index} className="font-mono text-xs">{step}</li>
              ))}
            </ul>
            {testResult && testResult.steps.length === 0 && (
              <p className="font-mono text-xs text-muted-foreground">Keine Protokolldaten empfangen. Die Funktion konnte möglicherweise nicht aufgerufen werden.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setTestResult(null)}>Schließen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Settings;