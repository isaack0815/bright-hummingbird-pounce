import { Users, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="h-8 w-1/2 bg-gray-200 animate-pulse rounded-md" />
      ) : (
        <div className="text-2xl font-bold">{value}</div>
      )}
      <p className="text-xs text-muted-foreground">{note}</p>
    </CardContent>
  </Card>
);

export function StatsWidget() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-8">
        <StatCard
          title="Aktive Nutzer"
          value={data?.userCount}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          note="Anzahl der registrierten Benutzer"
          isLoading={isLoading}
        />
        <StatCard
          title="Benutzergruppen"
          value={data?.roleCount}
          icon={<Shield className="h-4 w-4 text-muted-foreground" />}
          note="Anzahl der erstellten Gruppen"
          isLoading={isLoading}
        />
    </div>
  );
}