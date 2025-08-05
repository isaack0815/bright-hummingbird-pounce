import { Responsive, WidthProvider } from 'react-grid-layout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TodoWidget } from '@/components/dashboard/todos/TodoWidget';
import { StatsWidget } from '@/components/dashboard/StatsWidget';
import { FreightOrderWidget } from '@/components/dashboard/freight/FreightOrderWidget';
import { CalendarWidget } from '@/components/dashboard/calendar/CalendarWidget';
import type { DashboardLayout } from '@/types/dashboard';

const ResponsiveGridLayout = WidthProvider(Responsive);

const fetchLayout = async (): Promise<DashboardLayout> => {
  const { data, error } = await supabase.functions.invoke('get-dashboard-layout');
  if (error) throw new Error(error.message);
  return data.layout;
};

const componentMap: { [key: string]: React.ComponentType } = {
  todos: TodoWidget,
  stats: StatsWidget,
  freightOrders: FreightOrderWidget,
  calendar: CalendarWidget,
};

const Dashboard = () => {
  const { data: layout, isLoading } = useQuery<DashboardLayout>({
    queryKey: ['dashboardLayout'],
    queryFn: fetchLayout,
  });

  if (isLoading) {
    return <p>Lade Dashboard...</p>;
  }

  const enabledWidgets = layout?.filter(w => w.enabled) || [];
  const staticLayout = enabledWidgets.map(w => ({ ...w, isDraggable: false, isResizable: false }));

  return (
    <div>
      <h1 className="mb-4">Dashboard</h1>
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: staticLayout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={100}
        isDraggable={false}
        isResizable={false}
      >
        {enabledWidgets.map(widget => {
          const Component = componentMap[widget.i];
          if (!Component) return null;
          return (
            <div key={widget.i}>
              <Component />
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
};

export default Dashboard;