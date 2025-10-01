export type GarnishmentPayment = {
  id: number;
  garnishment_id: number;
  payment_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

export type Garnishment = {
  id: number;
  user_id: string;
  creditor: string;
  description: string | null;
  total_amount: number;
  status: 'open' | 'closed';
  created_at: string;
  paid_amount: number;
  remaining_amount: number;
  payments: GarnishmentPayment[];
};