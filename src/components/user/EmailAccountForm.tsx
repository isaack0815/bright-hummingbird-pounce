import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Form, Spinner, Alert, Placeholder } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const formSchema = z.object({
  email_address: z.string().email("Ungültige E-Mail-Adresse."),
  imap_username: z.string().min(1, "Benutzername ist erforderlich."),
  imap_password: z.string().optional(), // Optional, only for changing
});

type EmailAccountFormProps = {
  userId: string;
};

const fetchEmailAccount = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('get-email-account', {
        body: { userId }
    });
    if (error) throw error;
    return data.account;
}

export function EmailAccountForm({ userId }: EmailAccountFormProps) {
  const queryClient = useQueryClient();

  const { data: account, isLoading } = useQuery({
    queryKey: ['emailAccount', userId],
    queryFn: () => fetchEmailAccount(userId),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (account) {
        form.reset({
            email_address: account.email_address,
            imap_username: account.imap_username,
            imap_password: '',
        });
    }
  }, [account, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!values.imap_password && account) {
        // Allow saving other fields without changing password
        const { imap_password, ...rest } = values;
        const { error } = await supabase.functions.invoke('save-email-account', {
          body: { ...rest, userId },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke('save-email-account', {
          body: { ...values, userId },
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess("Kontodaten gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['emailAccount', userId] });
      form.reset({ ...form.getValues(), imap_password: '' });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern."),
  });

  const handleSave = () => {
    form.handleSubmit((v) => mutation.mutate(v))();
  };

  if (isLoading) {
    return <Placeholder as="div" animation="glow"><Placeholder xs={12} style={{height: '200px'}} /></Placeholder>
  }

  return (
    <Form>
        <Alert variant="info">
            Die IMAP-Serverdaten (Host, Port) werden aus den globalen Einstellungen übernommen. Das Passwort wird verschlüsselt gespeichert.
        </Alert>
        <Form.Group className="mb-3">
            <Form.Label>E-Mail-Adresse</Form.Label>
            <Form.Control {...form.register("email_address")} isInvalid={!!form.formState.errors.email_address} />
        </Form.Group>
        <Form.Group className="mb-3">
            <Form.Label>IMAP Benutzername</Form.Label>
            <Form.Control {...form.register("imap_username")} isInvalid={!!form.formState.errors.imap_username} />
        </Form.Group>
        <Form.Group className="mb-3">
            <Form.Label>IMAP Passwort</Form.Label>
            <Form.Control type="password" {...form.register("imap_password")} placeholder={account ? "Zum Ändern neu eingeben" : ""} isInvalid={!!form.formState.errors.imap_password} />
        </Form.Group>
        <Button type="button" onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner as="span" size="sm" /> : "Speichern"}
        </Button>
    </Form>
  );
}