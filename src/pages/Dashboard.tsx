import { StatsWidget } from '@/components/dashboard/StatsWidget';
import { TodoWidget } from '@/components/dashboard/todos/TodoWidget';
import { FreightOrderWidget } from '@/components/dashboard/freight/FreightOrderWidget';
import { CalendarWidget } from '@/components/dashboard/calendar/CalendarWidget';

const Dashboard = () => {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5">
        {/* This is a placeholder for where the stats cards would go. I will refactor the StatsWidget next. */}
      </div>
      <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6 md:gap-6 2xl:mt-7.5">
        <div className="col-span-12 xl:col-span-8">
          <FreightOrderWidget />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <TodoWidget />
        </div>
        <div className="col-span-12">
            <CalendarWidget />
        </div>
      </div>
    </>
  );
};

export default Dashboard;