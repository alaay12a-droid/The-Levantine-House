import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { fetchAcceptedOrders } from '@/services/levantineApi/orders';
import {
  loadPrintedOrderIds,
  savePrintedOrderId,
} from '@/services/printedOrders';
import { printOrderReceipt } from '@/services/sunmiPrinter';
import type { RemoteOrder } from '@/types/remoteOrder';

const POLL_INTERVAL_MS = 5000;
const RETRY_DELAY_MS = 30000;

export function useAutomaticOrderPrinter() {
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [lastPrintedOrder, setLastPrintedOrder] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const printedIdsRef = useRef<Set<number>>(new Set());
  const inFlightIds = useRef<Set<number>>(new Set());
  const retryAfter = useRef<Map<number, number>>(new Map());
  const pollRunning = useRef(false);
  const mounted = useRef(true);

  const poll = useCallback(async () => {
    if (pollRunning.current) return;
    pollRunning.current = true;

    try {
      const acceptedOrders = await fetchAcceptedOrders();
      if (!mounted.current) return;
      setIsConnected(true);
      setError(null);

      const unprinted = acceptedOrders.filter(
        (order) => !printedIdsRef.current.has(order.id),
      );
      setOrders(unprinted);

      if (Platform.OS !== 'android') return;

      for (const order of unprinted) {
        if (inFlightIds.current.has(order.id)) continue;
        if ((retryAfter.current.get(order.id) ?? 0) > Date.now()) continue;

        inFlightIds.current.add(order.id);
        setActiveOrderId(order.id);
        Vibration.vibrate([0, 250, 120, 250]);

        try {
          await printOrderReceipt({
            orderNumber: order.dailyNumber ?? order.id,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerAddress: order.customerAddress ?? 'استلام من الفرع',
            items: order.items,
            total: order.total,
            deliveryFee: order.deliveryFee,
            notes: order.notes ?? undefined,
            printedAt: new Date(),
          });
          printedIdsRef.current = await savePrintedOrderId(
            printedIdsRef.current,
            order.id,
          );
          retryAfter.current.delete(order.id);
          setOrders((current) =>
            current.filter((item) => item.id !== order.id),
          );
          setLastPrintedOrder(order.dailyNumber ?? order.id);
        } catch (printError) {
          retryAfter.current.set(order.id, Date.now() + RETRY_DELAY_MS);
          setError(
            printError instanceof Error
              ? printError.message
              : 'تعذرت الطباعة، ستتم المحاولة مجددًا.',
          );
        } finally {
          inFlightIds.current.delete(order.id);
          setActiveOrderId(null);
        }
      }
    } catch (pollError) {
      if (!mounted.current) return;
      setIsConnected(false);
      setError(
        pollError instanceof Error
          ? pollError.message
          : 'تعذر الاتصال بخادم البيت الشامي.',
      );
    } finally {
      pollRunning.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = async () => {
      try {
        printedIdsRef.current = await loadPrintedOrderIds();
      } catch {
        setError('تعذر قراءة سجل الطباعة المحلي.');
      }
      if (Platform.OS === 'web') return;
      await poll();
      timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    };

    void start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void poll();
    });

    return () => {
      mounted.current = false;
      if (timer) clearInterval(timer);
      subscription.remove();
    };
  }, [poll]);

  return {
    orders,
    isConnected,
    activeOrderId,
    lastPrintedOrder,
    error,
    isPreview: Platform.OS === 'web',
  };
}