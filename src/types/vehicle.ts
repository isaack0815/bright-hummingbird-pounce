export type VehicleGroup = {
  id: number;
  name: string;
  description: string | null;
};

export type VehicleNoteCategory = {
  id: number;
  name: string;
};

export type VehicleFileCategory = {
  id: number;
  name: string;
};

export type VehicleFile = {
  id: number;
  vehicle_id: number;
  file_path: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
  category_name: string;
  first_name: string | null;
  last_name: string | null;
};

export type VehicleNote = {
  id: number;
  vehicle_id: number;
  note: string;
  created_at: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  category_id: number;
  category_name: string;
};

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
  max_payload_kg: number | null;
  next_service_date: string | null;
  gas_inspection_due_date: string | null;
  driver_id: string | null;
  group_id: number | null;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  vehicle_groups: {
    id: number;
    name: string;
  } | null;
};