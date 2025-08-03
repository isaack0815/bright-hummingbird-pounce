import type { Layout } from 'react-grid-layout';

// Wir kombinieren die react-grid-layout Eigenschaften mit unseren eigenen.
export type DashboardWidget = Layout & {
  enabled: boolean;
};

export type DashboardLayout = DashboardWidget[];