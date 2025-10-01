import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Card, Form, Spinner, Placeholder } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich."),
  lastName: z.string().min(1, "Nachname ist erforderlich."),
  email: z.string().email(),
});

const fetchUserProfile = async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Benutzer nicht gefunden.");

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();
  
  if (profileError) throw profileError;

  return {
    email: user.email,
    firstName: profile?.first_name,
    lastName: profile?.last_name,
  };
};

const Profile = () => {
  const queryClient = useQueryClient();
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: fetchUserProfile,
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
    },
  });

  useEffect(() => {
    if (userProfile) {
      form.reset({
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        email: userProfile.email || "",
      });
    }
  }, [userProfile, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: z.infer<typeof profileSchema>) => {
      const { error } = await supabase.functions.invoke('update-my-profile', {
        body: {
          firstName: values.firstName,
          lastName: values.lastName,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Profil erfolgreich aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (err: any) => {
      showError(err.message || "Fehler beim Aktualisieren des Profils.");
    },
  });

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    updateProfileMutation.mutate(values);
  };

  return (
    <div>
      <h1 className="h2 mb-4">Mein Profil</h1>
      <div className="row g-4">
        <div className="col-lg-8">
          <Card>
            <Card.Header>
              <Card.Title>Profilinformationen</Card.Title>
              <Card.Text className="text-muted">Bearbeiten Sie hier Ihre persönlichen Daten.</Card.Text>
            </Card.Header>
            <Card.Body>
              {isLoading ? (
                <Placeholder as="div" animation="glow">
                  <Placeholder xs={12} className="mb-3" />
                  <Placeholder xs={12} className="mb-3" />
                  <Placeholder xs={12} className="mb-3" />
                  <Placeholder.Button xs={3} />
                </Placeholder>
              ) : (
                <Form onSubmit={form.handleSubmit(onSubmit)}>
                  <Form.Group className="mb-3" controlId="profileEmail">
                    <Form.Label>Email</Form.Label>
                    <Form.Control type="email" {...form.register("email")} disabled />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="profileFirstName">
                    <Form.Label>Vorname</Form.Label>
                    <Form.Control type="text" placeholder="Max" {...form.register("firstName")} isInvalid={!!form.formState.errors.firstName} />
                    <Form.Control.Feedback type="invalid">{form.formState.errors.firstName?.message}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="profileLastName">
                    <Form.Label>Nachname</Form.Label>
                    <Form.Control type="text" placeholder="Mustermann" {...form.register("lastName")} isInvalid={!!form.formState.errors.lastName} />
                    <Form.Control.Feedback type="invalid">{form.formState.errors.lastName?.message}</Form.Control.Feedback>
                  </Form.Group>
                  <Button type="submit" disabled={updateProfileMutation.isPending}>
                    {updateProfileMutation.isPending ? <Spinner as="span" animation="border" size="sm" /> : "Änderungen speichern"}
                  </Button>
                </Form>
              )}
            </Card.Body>
          </Card>
        </div>
        <div className="col-lg-4">
          <Card>
            <Card.Header>
              <Card.Title>Einstellungen</Card.Title>
            </Card.Header>
            <Card.Body>
              <NavLink to="/profile/dashboard-settings" className="btn btn-outline-secondary w-100">
                <LayoutDashboard className="me-2" size={16} />
                Dashboard anpassen
              </NavLink>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;