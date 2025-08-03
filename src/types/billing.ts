export type BillingLineItem = {
  id?: number;
  order_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_type: 'fixed' | 'percentage';
  vat_rate: number;
};