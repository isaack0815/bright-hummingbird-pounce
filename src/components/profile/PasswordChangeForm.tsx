import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";

const passwordSchema = z.object({
  newPassword: z.string().min(6, "Das neue Passwort muss mindestens 6 Zeichen lang sein."),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Die Passwörter stimmen nicht überein.",
  path: ["confirmPassword"],
});

export const PasswordChangeForm = () => {
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof passwordSchema>) => {
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Passwort erfolgreich geändert!");
      form.reset();
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Ändern des Passworts.");
    },
  });

  return (
    <Card>
      <Card.Header>
        <Card.Title>Passwort ändern</Card.Title>
      </Card.Header>
      <Card.Body>
        <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          <Form.Group className="mb-3">
            <Form.Label>Neues Passwort</Form.Label>
            <Form.Control type="password" {...form.register("newPassword")} isInvalid={!!form.formState.errors.newPassword} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.newPassword?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Neues Passwort bestätigen</Form.Label>
            <Form.Control type="password" {...form.register("confirmPassword")} isInvalid={!!form.formState.errors.confirmPassword} />
            <Form.Control.Feedback type="invalid">{form.formState.errors.confirmPassword?.message}</Form.Control.Feedback>
          </Form.Group>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner as="span" size="sm" /> : "Passwort speichern"}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
};