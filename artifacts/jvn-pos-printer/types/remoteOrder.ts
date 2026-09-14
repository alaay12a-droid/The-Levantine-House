import type { PrintableOrderItem } from '@/types/order';

export type RemoteOrder = {
  id: number;
  dailyNumber: number | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  items: PrintableOrderItem[];
  total: number;
  deliveryFee: number;
  notes: string | null;
  status: string;
  createdAt: string;
};