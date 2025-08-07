import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, NavLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { Card, Row, Col, Button, Form, Spinner, Tabs, Tab, Table } from 'react-bootstrap';
import { ArrowLeft, Save } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { EmailAccountForm } from '@/components/user/EmailAccountForm';

const formSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich."),
  lastName: z.string().min(1, "Nachname ist erforderlich."),
  username: z.string().min(3, "Benutzername muss mind. 3 Zeichen haben.").regex(/^[a-zA-Z0-9_]+$/, "Nur Buchstaben, Zahlen und Unterstriche."),
  birthDate: z.string().nullable().optional(),
  vacationDays: z.coerce.number().optional(),
  commuteKm: z.coerce.number().optional(),
  hoursPerWeek: z.coerce.number().optional(),
});

const fetchUserDetails = async (userId: string) => {
  const { data, error } = await supabase.functions.invoke('get-user-details', {
    body: { userId },
  });
  if (error) throw error;
  return data.user;
};

const PersonnelFile = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['userDetails', id],
    queryFn: () => fetchUserDetails(id!),
    enabled: !!id,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        username: user.username || "",
        birthDate: user.birth_date ? format(parseISO(user.birth_date), 'yyyy-MM-dd') : "",
        vacationDays: user.vacation_days_per_year || undefined,
        commuteKm: user.commute_km || undefined,
        hoursPerWeek: user.work_hours_history?.[0]?.hours_per_week || undefined,
      });
    }
  }, [user, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase.functions.invoke('update-user', {
        body: { userId: id, ...values },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Daten erfolgreich gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['userDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern."),
  });

  if (isLoading) return <p>Lade Personalakte...</p>;
  if (!user) return <p>Benutzer nicht gefunden.</p>;

  return (
    <Form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <NavLink to="/users" className="btn btn-outline-secondary p-2 lh-1"><ArrowLeft size={16} /></NavLink>
          <h1 className="h2 mb-0">Personalakte: {user.first_name} {user.last_name}</h1>
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner size="sm" className="me-2" /> : <Save size={16} className="me-2" />}
          Speichern
        </Button>
      </div>

      <Card>
        <Card.Body>
          <Tabs defaultActiveKey="general" className="mb-3">
            <Tab eventKey="general" title="Stammdaten">
              <Row className="g-3 pt-3">
                <Col md={6}><Form.Group><Form.Label>Vorname</Form.Label><Form.Control {...form.register("firstName")} /></Form.Group></Col>
                <Col md={6}><Form.Group><Form.Label>Nachname</Form.Label><Form.Control {...form.register("lastName")} /></Form.Group></Col>
                <Col md={6}><Form.Group><Form.Label>Benutzername</Form.Label><Form.Control {...form.register("username")} /></Form.Group></Col>
                <Col md={6}><Form.Group><Form.Label>Geburtsdatum</Form.Label><Form.Control type="date" {...form.register("birthDate")} /></Form.Group></Col>
                <Col md={12}><Form.Group><Form.Label>Email</Form.Label><Form.Control type="email" value={user.email} disabled /></Form.Group></Col>
              </Row>
            </Tab>
            <Tab eventKey="hr" title="Arbeitsverhältnis">
              <Row className="g-3 pt-3">
                <Col md={4}><Form.Group><Form.Label>Urlaubstage / Jahr</Form.Label><Form.Control type="number" {...form.register("vacationDays")} /></Form.Group></Col>
                <Col md={4}><Form.Group><Form.Label>Anfahrt (km)</Form.Label><Form.Control type="number" {...form.register("commuteKm")} /></Form.Group></Col>
                <Col md={4}><Form.Group><Form.Label>Aktuelle Stunden / Woche</Form.Label><Form.Control type="number" step="0.01" {...form.register("hoursPerWeek")} /></Form.Group></Col>
              </Row>
            </Tab>
            <Tab eventKey="history" title="Stundenhistorie">
              <div className="pt-3">
                <Table striped bordered hover size="sm">
                  <thead><tr><th>Stunden / Woche</th><th>Gültig ab</th></tr></thead>
                  <tbody>
                    {user.work_hours_history?.map((entry: any) => (
                      <tr key={entry.id}>
                        <td>{entry.hours_per_week}</td>
                        <td>{new Date(entry.effective_date).toLocaleDateString('de-DE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Tab>
            <Tab eventKey="email" title="E-Mail-Konto">
                <div className="pt-3">
                    <EmailAccountForm userId={id!} />
                </div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </Form>
  );
};

export default PersonnelFile;