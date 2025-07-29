import type { Customer } from "@/pages/CustomerManagement";

export type Stop = {
  id?: number;
  order_id?: number;
  stop_type: 'Abholung' | 'Teillieferung' | 'Teilladung' | 'Lieferung';
  address: string;
  stop_date: string | null;
  time_start: string | null;
  time_end: string | null;
  position: number;
};

export type CargoItem = {
  id?: number;
  order_id?: number;
  quantity: number | null;
  cargo_type: string | null;
  description: string | null;
  weight: number | null;
  loading_meters: number | null;
};

export type FreightOrder = {
  id: number;
  order_number: string;
  external_order_number: string | null;
  customer_id: number;
  status: string;
  
  origin_address: string | null;
  pickup_date: string | null;
  pickup_time_start: string | null;
  pickup_time_end: string | null;

  destination_address: string | null;
  delivery_date: string | null;
  delivery_time_start: string | null;
  delivery_time_end: string | null;

  price: number | null;
  description: string | null;
  created_at: string;
  created_by: string | null;
  
  customers: Pick<Customer, 'id' | 'company_name'> | null;
  freight_order_stops: Stop[];
  cargo_items: CargoItem[];
};