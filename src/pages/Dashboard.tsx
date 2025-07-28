import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';

type DashboardStats = {
  userCount: number;
  roleCount: number;
};

const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const { data, error } = await supabase.functions.invoke('get-dashboard-stats');
  if (error) throw new Error(error.message);
  return data;
};

const Dashboard = () => {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-foreground">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive Nutzer</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-1/4 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{data?.userCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Anzahl der registrierten Benutzer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Benutzergruppen</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-1/4 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{data?.roleCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Anzahl der erstellten Gruppen</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;