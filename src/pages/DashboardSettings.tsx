import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import { Save, ArrowLeft } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { showError, showSuccess } from '@/utils/toast';
import type { DashboardLayout, DashboardWidget } from '@/types/dashboard';
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

const availableWidgets = [
  { i: 'stats', name: 'Statistiken', description: 'Zeigt Nutzer- und Gruppenzahlen an.', defaultW: 12, defaultH: 1 },
  { i: 'todos', name: 'Meine ToDos', description: 'Listet Ihre persönlichen Aufgaben auf.', defaultW: 6, defaultH: 4 },
];

const fetchLayout = async (): Promise<DashboardLayout> => {
  const { data, error } = await supabase.functions.invoke('get-dashboard-layout');
  if (error) throw new Error(error.message);
  return data.layout;
};

const DashboardSettings = () => {
  const queryClient = useQueryClient();
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout>([]);

  const { data: savedLayout, isLoading } = useQuery<DashboardLayout>({
    queryKey: ['dashboardLayout'],
    queryFn: fetchLayout,
  });

  useEffect(() => {
    if (savedLayout) {
      const fullLayout = availableWidgets.map(widget => {
        const saved = savedLayout.find(l => l.i === widget.i);
        return saved || { 
          i: widget.i, 
          x: 0, y: 999, // Use a large but finite number for initial placement
          w: widget.defaultW, h: widget.defaultH, 
          enabled: false 
        };
      });
      setCurrentLayout(fullLayout);
    }
  }, [savedLayout]);

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

  const onLayoutChange = (newLayout: Layout[]) => {
    setCurrentLayout(prevLayout => {
      return prevLayout.map(widget => {
        const layoutItem = newLayout.find(l => l.i === widget.i);
        return layoutItem ? { ...widget, ...layoutItem } : widget;
      });
    });
  };

  const onToggleWidget = (widgetId: string, isEnabled: boolean) => {
    setCurrentLayout(prev => {
      const newLayout = [...prev];
      const widgetIndex = newLayout.findIndex(w => w.i === widgetId);
      if (widgetIndex === -1) return prev;

      const widget = { ...newLayout[widgetIndex], enabled: isEnabled };
      
      // If we just enabled a widget, place it at the bottom.
      if (isEnabled) {
          const enabledWidgets = newLayout.filter(w => w.enabled && w.i !== widgetId);
          const maxY = Math.max(0, ...enabledWidgets.map(w => w.y + w.h));
          widget.y = maxY;
          widget.x = 0;
      }
      
      newLayout[widgetIndex] = widget;
      return newLayout;
    });
  };

  const onSubmit = () => {
    mutation.mutate(currentLayout);
  };

  if (isLoading) {
    return <p>Lade Layout...</p>;
  }

  const enabledWidgets = currentLayout.filter(w => w.enabled);

  return (
    <Form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
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

      <Row className="g-4">
        <Col lg={8}>
          <Card>
            <Card.Header>
              <Card.Title>Layout-Vorschau</Card.Title>
              <Card.Text className="text-muted">Verschieben Sie die Module und passen Sie ihre Größe an.</Card.Text>
            </Card.Header>
            <Card.Body style={{ minHeight: '60vh' }}>
              <ResponsiveGridLayout
                layouts={{ lg: enabledWidgets }}
                onLayoutChange={onLayoutChange}
                breakpoints={{ lg: 1200 }}
                cols={{ lg: 12 }}
                rowHeight={100}
              >
                {enabledWidgets.map(widget => (
                  <div key={widget.i}>
                    <div className="h-100 d-flex align-items-center justify-content-center bg-light border rounded">
                      <span className="text-muted fw-bold">{availableWidgets.find(w => w.i === widget.i)?.name}</span>
                    </div>
                  </div>
                ))}
              </ResponsiveGridLayout>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card>
            <Card.Header>
              <Card.Title>Module</Card.Title>
              <Card.Text className="text-muted">Aktivieren oder deaktivieren Sie Module.</Card.Text>
            </Card.Header>
            <Card.Body>
              {availableWidgets.map(widget => {
                const currentWidget = currentLayout.find(l => l.i === widget.i);
                return (
                  <div key={widget.i} className="mb-2">
                    <Form.Check 
                      type="switch"
                      id={`widget-switch-${widget.i}`}
                      label={widget.name}
                      checked={currentWidget?.enabled || false}
                      onChange={(e) => onToggleWidget(widget.i, e.target.checked)}
                    />
                    <p className="small text-muted ms-4">{widget.description}</p>
                  </div>
                );
              })}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Form>
  );
};

export default DashboardSettings;