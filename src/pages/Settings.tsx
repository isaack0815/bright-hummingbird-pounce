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
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

type Setting = {
  key: string;
  value: string | null;
  description: string | null;
};

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

const Settings = () => {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery<Setting[]>({
    queryKey: ['settings'],
    queryFn: fetchSettings,
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

  const onSubmit = (values: z.infer<typeof settingsSchema>) => {
    updateSettingsMutation.mutate(values);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-foreground">Einstellungen</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  Die SMTP-Zugangsdaten (Host, Port, Benutzer, Passwort) müssen als Secrets direkt in Ihrem Supabase-Projekt unter "Edge Functions" &gt; "Manage Secrets" hinterlegt werden. Die Schlüssel müssen `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` und `SMTP_FROM_EMAIL` lauten.
                </AlertDescription>
              </Alert>
              {isLoading ? <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div> : (
                <div className="space-y-4">
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
          
          <div className="flex justify-end">
            <Button type="submit" disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? "Wird gespeichert..." : "Alle Einstellungen speichern"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default Settings;