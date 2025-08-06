import type { Customer as BaseCustomer } from '@/pages/CustomerManagement';
import type { FreightOrder } from './freight';

export type Customer = BaseCustomer;

export type CustomerDetails = {
  customer: Customer;
  orders: FreightOrder[];
};