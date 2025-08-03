import { Card, Row, Col, Placeholder } from 'react-bootstrap';
import { Users, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type DashboardStats = {
  userCount: number;
  roleCount: number;
};

const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const { data, error } = await supabase.functions.invoke('get-dashboard-stats');
  if (error) throw new Error(error.message);
  return data;
};

const StatCard = ({ title, value, icon, note, isLoading }: { title: string, value?: number, icon: React.ReactNode, note: string, isLoading: boolean }) => (
  <Card className="shadow-sm h-100">
    <Card.Body>
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <h6 className="card-subtitle mb-2 text-muted">{title}</h6>
          {isLoading ? (
            <Placeholder as="p" animation="glow" className="mt-2">
              <Placeholder xs={6} size="lg" />
            </Placeholder>
          ) : (
            <div className="h2 fw-bold">{value}</div>
          )}
        </div>
        {icon}
      </div>
      <Card.Text className="text-muted small mt-1">
        {note}
      </Card.Text>
    </Card.Body>
  </Card>
);

export function StatsWidget() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
  });

  return (
    <Row>
      <Col md={6} className="mb-4 mb-md-0">
        <StatCard
          title="Aktive Nutzer"
          value={data?.userCount}
          icon={<Users className="text-muted" size={24} />}
          note="Anzahl der registrierten Benutzer"
          isLoading={isLoading}
        />
      </Col>
      <Col md={6}>
        <StatCard
          title="Benutzergruppen"
          value={data?.roleCount}
          icon={<Shield className="text-muted" size={24} />}
          note="Anzahl der erstellten Gruppen"
          isLoading={isLoading}
        />
      </Col>
    </Row>
  );
}