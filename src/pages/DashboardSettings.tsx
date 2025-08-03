import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { Card, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import { Save, ArrowLeft } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { showError, showSuccess } from '@/utils/toast';
import type { DashboardLayout } from '@/types/dashboard';
import { useEffect } from 'react';

const availableWidgets = [
  { id: 'stats', name: 'Statistiken', description: 'Zeigt Nutzer- und Gruppenzahlen an.', defaultWidth: 6 },
  { id: 'todos', name: 'Meine ToDos', description: 'Listet Ihre persönlichen Aufgaben auf.', defaultWidth: 6 },
];

const fetchLayout = async (): Promise<DashboardLayout> => {
  const { data, error } = await supabase.functions.invoke('get-dashboard-layout');
  if (error) throw new Error(error.message);
  return data.layout;
};

const DashboardSettings = () => {
  const queryClient = useQueryClient();
  const { data: layout, isLoading } = useQuery<DashboardLayout>({
    queryKey: ['dashboardLayout'],
    queryFn: fetchLayout,
  });

  const { control, handleSubmit, reset } = useForm<{ layout: DashboardLayout }>({
    defaultValues: { layout: [] },
  });

  const { fields, update } = useFieldArray({
    control,
    name: 'layout',
    keyName: 'key',
  });

  useEffect(() => {
    if (layout) {
      // Sync available widgets with saved layout
      const newLayout = availableWidgets.map(widget => {
        const savedWidget = layout.find(l => l.id === widget.id);
        return savedWidget || { ...widget, col: 1, row: 99, enabled: false, height: 1 };
      });
      reset({ layout: newLayout });
    }
  }, [layout, reset]);

  const mutation = useMutation({
    mutationFn: async (newLayout: DashboardLayout) => {
      const { error } = await supabase.functions.invoke('update-dashboard-layout', {
        body: { layout: newLayout },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Dashboard-Layout gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['dashboardLayout'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern."),
  });

  const onSubmit = (data: { layout: DashboardLayout }) => {
    mutation.mutate(data.layout);
  };

  if (isLoading) {
    return <p>Lade Layout...</p>;
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <NavLink to="/profile" className="btn btn-outline-secondary btn-sm p-2 lh-1"><ArrowLeft size={16} /></NavLink>
          <h1 className="h2 mb-0">Dashboard anpassen</h1>
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner size="sm" className="me-2" /> : <Save size={16} className="me-2" />}
          Layout speichern
        </Button>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Module verwalten</Card.Title>
          <Card.Text className="text-muted">Aktivieren und konfigurieren Sie die Module für Ihr Dashboard.</Card.Text>
        </Card.Header>
        <Card.Body>
          <Row className="g-3">
            {fields.map((field, index) => {
              const widgetInfo = availableWidgets.find(w => w.id === field.id)!;
              return (
                <Col md={6} key={field.key}>
                  <Card className="h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <Card.Title as="h6">{widgetInfo.name}</Card.Title>
                          <Card.Text className="small text-muted">{widgetInfo.description}</Card.Text>
                        </div>
                        <Form.Check
                          type="switch"
                          id={`enabled-${index}`}
                          checked={field.enabled}
                          onChange={(e) => update(index, { ...field, enabled: e.target.checked })}
                        />
                      </div>
                      {field.enabled && (
                        <Row className="g-2 mt-2">
                          <Col xs={4}>
                            <Form.Group><Form.Label className="small">Breite</Form.Label><Form.Select size="sm" value={field.width} onChange={(e) => update(index, { ...field, width: parseInt(e.target.value) })}><option value="3">25%</option><option value="4">33%</option><option value="6">50%</option><option value="8">66%</option><option value="9">75%</option><option value="12">100%</option></Form.Select></Form.Group>
                          </Col>
                          <Col xs={4}>
                            <Form.Group><Form.Label className="small">Reihe</Form.Label><Form.Control size="sm" type="number" value={field.row} onChange={(e) => update(index, { ...field, row: parseInt(e.target.value) })} /></Form.Group>
                          </Col>
                          <Col xs={4}>
                            <Form.Group><Form.Label className="small">Position</Form.Label><Form.Control size="sm" type="number" value={field.col} onChange={(e) => update(index, { ...field, col: parseInt(e.target.value) })} /></Form.Group>
                          </Col>
                        </Row>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card.Body>
      </Card>
    </Form>
  );
};

export default DashboardSettings;