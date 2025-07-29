import type { Customer } from "@/pages/CustomerManagement";

export type FreightOrder = {
  id: number;
  customer_id: number;
  status: string;
  origin_address: string | null;
  destination_address: string | null;
  pickup_date: string | null;
  delivery_date: string | null;
  cargo_description: string | null;
  price: number | null;
  created_at: string;
  customers: Pick<Customer, 'id' | 'company_name'> | null;
};