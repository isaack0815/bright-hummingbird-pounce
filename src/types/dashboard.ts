export type DashboardWidgetConfig = {
  id: string;
  col: number;
  row: number;
  width: number; // in grid columns (1-12)
  height: number; // in rows
  enabled: boolean;
};

export type DashboardLayout = DashboardWidgetConfig[];