export type OrderItem = {
  id: string;
  name: string;
  quantity: string;
  price: string;
};

export type PrintableOrderItem = {
  name: string;
  quantity: number;
  price: number;
};

export type PrintableOrder = {
  orderNumber?: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: PrintableOrderItem[];
  total: number;
  deliveryFee?: number;
  notes?: string;
  printedAt: Date;
};