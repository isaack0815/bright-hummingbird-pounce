import { StatsWidget } from '@/components/dashboard/StatsWidget';
import { TodoWidget } from '@/components/dashboard/todos/TodoWidget';
import { FreightOrderWidget } from '@/components/dashboard/freight/FreightOrderWidget';
import { CalendarWidget } from '@/components/dashboard/calendar/CalendarWidget';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DashboardLayout } from '@/types/dashboard';
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

const fetchLayout = async (): Promise<DashboardLayout> => {
  const { data, error } = await supabase.functions.invoke('get-dashboard-layout');
  if (error) throw new Error(error.message);
  return data.layout;
};

const widgetMap: { [key: string]: React.ComponentType } = {
  stats: StatsWidget,
  todos: TodoWidget,
  freightOrders: FreightOrderWidget,
  calendar: CalendarWidget,
};

const Dashboard = () => {
  const { data: layout, isLoading } = useQuery<DashboardLayout>({
    queryKey: ['dashboardLayout'],
    queryFn: fetchLayout,
  });

  if (isLoading) {
    return <div>Lade Dashboard...</div>;
  }

  const enabledWidgets = layout?.filter(w => w.enabled) || [];

  return (
    <ResponsiveGridLayout
      layouts={{ lg: enabledWidgets }}
      isDraggable={false}
      isResizable={false}
      breakpoints={{ lg: 1200 }}
      cols={{ lg: 12 }}
      rowHeight={100}
      margin={[24, 24]}
    >
      {enabledWidgets.map(widget => {
        const Component = widgetMap[widget.i];
        return (
          <div key={widget.i}>
            {Component ? <Component /> : <div className="bg-gray-200 h-full w-full rounded-lg flex items-center justify-center">Widget not found: {widget.i}</div>}
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
};

export default Dashboard;