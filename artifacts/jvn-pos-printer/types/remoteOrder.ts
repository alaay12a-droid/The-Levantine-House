import type { PrintableOrderItem } from '@/types/order';

export type RemoteOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: PrintableOrderItem[];
  total: number;
  status: 'pending';
  createdAt: string;
};

export type OrdersConnectionState =
  | 'not-configured'
  | 'connecting'
  | 'connected'
  | 'error';