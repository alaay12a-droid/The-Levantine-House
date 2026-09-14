import type { RemoteOrder } from '@/types/remoteOrder';

const API_BASE_URL = 'https://the-levantine-house-45jt.onrender.com/api';

type ApiOrder = {
  id: number;
  dailyNumber: number | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  items: { name: string; price: number; quantity: number }[];
  totalPrice: number;
  deliveryFee: number;
  notes: string | null;
  status: string;
  createdAt: string;
};

function mapOrder(order: ApiOrder): RemoteOrder {
  const rawSubtotal = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const expectedSubtotal =
    order.totalPrice / 100 - (order.deliveryFee ?? 0) / 100;
  const priceFactor =
    rawSubtotal > 0 && expectedSubtotal > rawSubtotal * 50
      ? expectedSubtotal / rawSubtotal
      : 1;

  return {
    id: order.id,
    dailyNumber: order.dailyNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price * priceFactor,
    })),
    total: order.totalPrice / 100,
    deliveryFee: (order.deliveryFee ?? 0) / 100,
    notes: order.notes,
    status: order.status,
    orderType: order.customerAddress ? 'delivery' : 'pickup',
    createdAt: order.createdAt,
  };
}

export async function fetchAcceptedOrders(): Promise<RemoteOrder[]> {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`تعذر جلب الطلبات من الخادم (${response.status}).`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('استجابة الطلبات من الخادم غير صالحة.');
  }

  return (data as ApiOrder[])
    .filter((order) => order.status === 'preparing')
    .map(mapOrder)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}