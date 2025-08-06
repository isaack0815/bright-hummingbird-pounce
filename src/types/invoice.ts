export type LexInvoice = {
  id: string;
  voucherNumber: string;
  contactName: string;
  voucherDate: string;
  voucherStatus: 'open' | 'paid' | 'voided' | 'overdue';
  totalPrice: {
    currency: string;
    totalGrossAmount: number;
  } | null;
};