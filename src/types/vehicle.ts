export type Vehicle = {
  id: number;
  license_plate: string;
  brand: string | null;
  model: string | null;
  type: string | null;
  vin: string | null;
  year_of_manufacture: number | null;
  inspection_due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  loading_area: number | null;
  next_service_date: string | null;
  gas_inspection_due_date: string | null;
};