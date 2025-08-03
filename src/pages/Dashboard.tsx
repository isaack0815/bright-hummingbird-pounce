import { Row, Col } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TodoWidget } from '@/components/dashboard/todos/TodoWidget';
import { StatsWidget } from '@/components/dashboard/StatsWidget';
import type { DashboardLayout } from '@/types/dashboard';

const fetchLayout = async (): Promise<DashboardLayout> => {
  const { data, error } = await supabase.functions.invoke('get-dashboard-layout');
  if (error) throw new Error(error.message);
  return data.layout;
};

const componentMap: { [key: string]: React.ComponentType } = {
  todos: TodoWidget,
  stats: StatsWidget,
};

const Dashboard = () => {
  const { data: layout, isLoading } = useQuery<DashboardLayout>({
    queryKey: ['dashboardLayout'],
    queryFn: fetchLayout,
  });

  const sortedEnabledWidgets = layout
    ?.filter(widget => widget.enabled)
    .sort((a, b) => a.row - b.row || a.col - b.col) || [];

  return (
    <div>
      <h1 className="mb-4">Dashboard</h1>
      {isLoading ? (
        <p>Lade Dashboard...</p>
      ) : (
        <Row>
          {sortedEnabledWidgets.map(widget => {
            const Component = componentMap[widget.id];
            if (!Component) return null;
            return (
              <Col lg={widget.width} key={widget.id} className="mb-4">
                <Component />
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};

export default Dashboard;