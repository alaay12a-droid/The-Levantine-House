import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RemoteOrder } from '@/types/remoteOrder';

const API_BASE_URL = 'https://the-levantine-house-45jt.onrender.com/api';

async function fetchWithArabicError(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let body = '';
    try {
      const data = await response.json();
      body = data.message || data.error || JSON.stringify(data);
    } catch {
      body = await response.text();
    }
    throw new Error(`خطأ ${response.status}: ${body || 'فشل الاتصال بالخادم'}`);
  }
  return response.json();
}

export type ApiOrder = {
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
  orderType?: 'delivery' | 'pickup';
  paymentMethod?: string;
  createdAt: string;
};

export function mapOrder(order: ApiOrder): RemoteOrder {
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
    customerName: order.customerName || 'عميل غير معروف',
    customerPhone: order.customerPhone || '',
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
    orderType:
      order.orderType === 'delivery' || order.orderType === 'pickup'
        ? order.orderType
        : order.customerAddress
          ? 'delivery'
          : 'pickup',
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
  };
}

export function useOrdersQuery() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const data = await fetchWithArabicError(`${API_BASE_URL}/orders`);
      return (data as ApiOrder[])
        .map(mapOrder)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    refetchInterval: 5000,
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return fetchWithArabicError(`${API_BASE_URL}/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export type AvailableDriver = {
  id: number;
  name: string;
  phone: string;
  photoUrl: string | null;
  distanceKm: number | null;
};

export async function fetchDriversAutoAssignSetting(): Promise<boolean> {
  const data = (await fetchWithArabicError(
    `${API_BASE_URL}/settings/drivers-auto-assign`,
  )) as { enabled: boolean };
  return data.enabled;
}

export async function fetchAvailableDrivers(): Promise<AvailableDriver[]> {
  return (await fetchWithArabicError(
    `${API_BASE_URL}/drivers/available`,
  )) as AvailableDriver[];
}

export async function assignDriverWhilePreparing(
  orderId: number,
  driverId?: number,
): Promise<{ ok: true; driverId: number; driverName: string; orderStatus: string }> {
  return (await fetchWithArabicError(
    `${API_BASE_URL}/orders/${orderId}/assign-driver-preparing`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(driverId ? { driverId } : {}),
    },
  )) as { ok: true; driverId: number; driverName: string; orderStatus: string };
}

export type ApiMenuItem = {
  itemId: string;
  name: string;
  nameEn: string;
  category: string;
  price: number;
  available: boolean;
  stock: number | null;
  imageKey: string | null;
  imageUrl: string | null;
  options: {
    groupName: string;
    required: boolean;
    choices: { name: string; extraPrice: number; available: boolean }[];
  }[];
};

export type ApiCategory = {
  id: string;
  name: string;
  nameEn: string;
  icon: string | null;
  imageUrl: string | null;
  isVisible: boolean;
};

export function useMenuQuery() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      return (await fetchWithArabicError(`${API_BASE_URL}/menu`)) as ApiMenuItem[];
    },
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      return (await fetchWithArabicError(`${API_BASE_URL}/menu/categories`)) as ApiCategory[];
    },
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, available }: { itemId: string; available: boolean }) => {
      return fetchWithArabicError(`${API_BASE_URL}/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available }),
      });
    },
    onMutate: async ({ itemId, available }) => {
      await queryClient.cancelQueries({ queryKey: ['menu'] });
      const previousMenu = queryClient.getQueryData<ApiMenuItem[]>(['menu']);
      if (previousMenu) {
        queryClient.setQueryData<ApiMenuItem[]>(['menu'], (old) => {
          if (!old) return old;
          return old.map((item) => (item.itemId === itemId ? { ...item, available } : item));
        });
      }
      return { previousMenu };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousMenu) {
        queryClient.setQueryData(['menu'], context.previousMenu);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}

export type BranchHours = {
  enabled: boolean;
  days: { enabled: boolean; open: string; close: string }[];
};

export function useBranchHoursQuery() {
  return useQuery({
    queryKey: ['branch-hours'],
    queryFn: async () => {
      return (await fetchWithArabicError(`${API_BASE_URL}/branch-hours`)) as BranchHours;
    },
  });
}

export function useUpdateBranchHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BranchHours) => {
      return fetchWithArabicError(`${API_BASE_URL}/branch-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branch-hours'] }),
  });
}

export type SettingsSounds = {
  muted: boolean;
  order: boolean;
  message: boolean;
  delivery: boolean;
};

export function useSettingsSoundsQuery() {
  return useQuery({
    queryKey: ['settings-sounds'],
    queryFn: async () => {
      return (await fetchWithArabicError(`${API_BASE_URL}/settings/sounds`)) as SettingsSounds;
    },
  });
}

export function useUpdateSettingsSounds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SettingsSounds) => {
      return fetchWithArabicError(`${API_BASE_URL}/settings/sounds`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-sounds'] }),
  });
}

export type SettingsPayment = {
  cash: boolean;
  electronic: boolean;
  wallet: boolean;
};

export function useSettingsPaymentQuery() {
  return useQuery({
    queryKey: ['settings-payment'],
    queryFn: async () => {
      return (await fetchWithArabicError(`${API_BASE_URL}/settings/payment`)) as SettingsPayment;
    },
  });
}

export function useUpdateSettingsPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SettingsPayment) => {
      return fetchWithArabicError(`${API_BASE_URL}/settings/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-payment'] }),
  });
}
