export type OrderFileWithDetails = {
  id: number;
  order_id: number;
  user_id: string;
  file_path: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
  is_archived: boolean;
  first_name: string | null;
  last_name: string | null;
  order_number: string;
};

export type VehicleFileWithDetails = {
  id: number;
  vehicle_id: number;
  file_path: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  license_plate: string;
};

export type FileActivityLog = {
  id: number;
  created_at: string;
  action: string;
  details: any;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};