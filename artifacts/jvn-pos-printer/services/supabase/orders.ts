import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { getSupabaseClient } from '@/services/supabase/client';
import type { RemoteOrder } from '@/types/remoteOrder';
import type { PrintableOrderItem } from '@/types/order';

type OrderRow = {
  id?: unknown;
  customer_name?: unknown;
  customer_phone?: unknown;
  customer_address?: unknown;
  address?: unknown;
  items?: unknown;
  total?: unknown;
  status?: unknown;
  created_at?: unknown;
};

type ItemRow = {
  name?: unknown;
  title?: unknown;
  quantity?: unknown;
  qty?: unknown;
  price?: unknown;
  unit_price?: unknown;
};

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`عمود ${field} مفقود أو غير صالح في أحد الطلبات.`);
  }
  return value.trim();
}

function positiveNumber(value: unknown, field: string): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`قيمة ${field} غير صالحة في أحد الطلبات.`);
  }
  return parsed;
}

function mapItems(value: unknown): PrintableOrderItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('عمود items يجب أن يكون مصفوفة JSON غير فارغة.');
  }

  return value.map((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object') {
      throw new Error(`الصنف رقم ${index + 1} غير صالح.`);
    }

    const item = rawItem as ItemRow;
    return {
      name: requiredText(item.name ?? item.title, `items[${index}].name`),
      quantity: positiveNumber(
        item.quantity ?? item.qty,
        `items[${index}].quantity`,
      ),
      price: positiveNumber(
        item.price ?? item.unit_price,
        `items[${index}].price`,
      ),
    };
  });
}

export function mapOrderRow(row: OrderRow): RemoteOrder {
  const status = requiredText(row.status, 'status');
  if (status !== 'pending') {
    throw new Error(`حالة الطلب ${status} ليست pending.`);
  }

  return {
    id: String(row.id ?? ''),
    customerName: requiredText(row.customer_name, 'customer_name'),
    customerPhone: requiredText(row.customer_phone, 'customer_phone'),
    customerAddress: requiredText(
      row.customer_address ?? row.address,
      'customer_address',
    ),
    items: mapItems(row.items),
    total: positiveNumber(row.total, 'total'),
    status: 'pending',
    createdAt: requiredText(row.created_at, 'created_at'),
  };
}

export async function fetchPendingOrders(): Promise<RemoteOrder[]> {
  const { data, error } = await getSupabaseClient()
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`تعذر تحميل الطلبات: ${error.message}`);
  }

  return (data ?? []).map((row) => mapOrderRow(row));
}

export async function markOrderPrinted(orderId: string): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('orders')
    .update({
      status: 'printed',
    })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    throw new Error(`تمت الطباعة لكن تعذر تحديث الحالة: ${error.message}`);
  }

  if (!data?.length) {
    throw new Error(
      'تمت الطباعة لكن الطلب لم يعد بحالة pending. تحقق من حالته في Supabase.',
    );
  }
}

type SubscriptionHandlers = {
  onPendingOrder: (order: RemoteOrder) => void;
  onOrderChanged: (orderId: string, status: string) => void;
  onConnected: () => void;
  onError: (message: string) => void;
};

export function subscribeToOrders(
  handlers: SubscriptionHandlers,
): RealtimeChannel {
  const client = getSupabaseClient();
  const channel = client
    .channel('jvn-orders')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: 'status=eq.pending',
      },
      (payload: RealtimePostgresChangesPayload<OrderRow>) => {
        try {
          handlers.onPendingOrder(mapOrderRow(payload.new));
        } catch (error) {
          handlers.onError(
            error instanceof Error ? error.message : 'وصل طلب بصيغة غير صالحة.',
          );
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
      },
      (payload: RealtimePostgresChangesPayload<OrderRow>) => {
        const newRow = payload.new as OrderRow;
        const id = String(newRow.id ?? '');
        const status =
          typeof newRow.status === 'string' ? newRow.status : '';
        if (id && status) handlers.onOrderChanged(id, status);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        handlers.onConnected();
      } else if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        handlers.onError(`انقطع الاشتراك اللحظي: ${status}`);
      }
    });

  return channel;
}

export async function removeOrdersSubscription(
  channel: RealtimeChannel,
): Promise<void> {
  await getSupabaseClient().removeChannel(channel);
}