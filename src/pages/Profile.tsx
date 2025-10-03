import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, Card, Spinner, Placeholder, Row, Col, Form } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PasswordChangeForm } from "@/components/profile/PasswordChangeForm";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { NavLink } from "react-router-dom";

const profileSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich."),
  lastName: z.string().min(1, "Nachname ist erforderlich."),
  username: z.string().min(3, "Benutzername muss mind. 3 Zeichen haben."),
  emailSignature: z.string().optional(),
});

const fetchMyFullProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, username, email_signature')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
};

const Profile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['myFullProfile', user?.id],
    queryFn: () => fetchMyFullProfile(user!.id),
    enabled: !!user,
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (userProfile) {
      form.reset({
        firstName: userProfile.first_name || '',
        lastName: userProfile.last_name || '',
        username: userProfile.username || '',
        emailSignature: userProfile.email_signature || '',
      });
    }
  }, [userProfile, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof profileSchema>) => {
      const { error } = await supabase.functions.invoke('update-my-profile', {
        body: values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Profil aktualisiert!");
      queryClient.invalidateQueries({ queryKey: ['myFullProfile', user?.id] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern."),
  });

  return (
    <div>
      <h1 className="h2 mb-4">Mein Profil</h1>
      <Row className="g-4">
        <Col lg={6}>
          <Card>
            <Card.Header>
              <Card.Title>Profilinformationen</Card.Title>
            </Card.Header>
            <Card.Body>
              {isLoading ? <Spinner /> : (
                <Form onSubmit={form.handleSubmit(v => mutation.mutate(v))}>
                  <Row className="g-3">
                    <Col md={6}><Form.Group><Form.Label>Vorname</Form.Label><Form.Control {...form.register("firstName")} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Nachname</Form.Label><Form.Control {...form.register("lastName")} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Benutzername</Form.Label><Form.Control {...form.register("username")} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>E-Mail</Form.Label><Form.Control value={user?.email} disabled /></Form.Group></Col>
                    <Col md={12}><Form.Group><Form.Label>E-Mail Signatur (HTML)</Form.Label><Form.Control as="textarea" rows={4} {...form.register("emailSignature")} /></Form.Group></Col>
                  </Row>
                  <Button type="submit" className="mt-3" disabled={mutation.isPending}>
                    {mutation.isPending ? <Spinner size="sm" /> : "Profil speichern"}
                  </Button>
                </Form>
              )}
            </Card.Body>
          </Card>
          <Card className="mt-4">
            <Card.Header><Card.Title>Weitere Einstellungen</Card.Title></Card.Header>
            <Card.Body>
              <NavLink to="/profile/dashboard-settings">
                <Button variant="outline-secondary">Dashboard anpassen</Button>
              </NavLink>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <PasswordChangeForm />
        </Col>
      </Row>
    </div>
  );
};

export default Profile;