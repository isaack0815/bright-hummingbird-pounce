export type Carrier = {
  id: number;
  name: string;
  company_address: string | null;
  email: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  license_plate: string | null;
  transporter_dimensions: string | null;
  payment_term_days: number | null;
  tax_number: string | null;
};