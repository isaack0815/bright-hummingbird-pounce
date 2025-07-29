import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";

type Setting = {
  key: string;
  value: string | null;
  description: string | null;
};

const settingsSchema = z.object({
  email_signature: z.string().optional(),
  email_bcc: z.string().email({ message: "Ungültige E-Mail-Adresse." }).optional().or(z.literal('')),
  payment_term_default: z.coerce.number().optional(),
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
      email_signature: "",
      email_bcc: "",
      payment_term_default: 45,
    },
  });

  useEffect(() => {
    if (settings) {
      const settingsMap = new Map(settings.map(s => [s.key, s.value]));
      form.reset({
        email_signature: settingsMap.get('email_signature') || "",
        email_bcc: settingsMap.get('email_bcc') || "",
        payment_term_default: Number(settingsMap.get('payment_term_default')) || 45,
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
              <CardTitle>Globale Einstellungen</CardTitle>
              <CardDescription>Systemweite Standardwerte und Konfigurationen.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <FormField
                  control={form.control}
                  name="payment_term_default"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard-Zahlungsfrist (Tage)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
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
                  Die SMTP-Zugangsdaten (Host, Port, Benutzer, Passwort) müssen als Secrets direkt in Ihrem Supabase-Projekt unter "Edge Functions" -> "Manage Secrets" hinterlegt werden. Die Schlüssel müssen `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` und `SMTP_FROM_EMAIL` lauten.
                </AlertDescription>
              </Alert>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email_bcc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BCC-Empfänger</FormLabel>
                        <FormControl>
                          <Input placeholder="bcc@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email_signature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Standard-Signatur (HTML)</FormLabel>
                        <FormControl>
                          <RichTextEditor {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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