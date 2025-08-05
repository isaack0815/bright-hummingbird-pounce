import type { Customer as BaseCustomer } from '@/pages/CustomerManagement';
import type { FreightOrder } from './freight';

export type Customer = BaseCustomer;

export type CustomerDetails = {
  customer: Customer;
  orders: FreightOrder[];
};

export type LexInvoice = {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  voucherStatus: 'open' | 'paid' | 'overdue' | 'voided' | 'draft';
  contactName: string;
  totalPrice?: {
    totalNetAmount: number;
    totalGrossAmount: number;
    currency: string;
  };
};