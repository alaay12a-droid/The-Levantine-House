import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Vibration } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  fetchPendingOrders,
  removeOrdersSubscription,
  subscribeToOrders,
} from '@/services/supabase/orders';
import { isSupabaseConfigured } from '@/services/supabase/client';
import type {
  OrdersConnectionState,
  RemoteOrder,
} from '@/types/remoteOrder';

export function useRealtimeOrders() {
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [connectionState, setConnectionState] =
    useState<OrdersConnectionState>(
      isSupabaseConfigured() ? 'connecting' : 'not-configured',
    );
  const [error, setError] = useState<string | null>(null);
  const [latestOrderName, setLatestOrderName] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showIncomingAlert = useCallback((order: RemoteOrder) => {
    setLatestOrderName(order.customerName);
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 350, 180, 350]);
    }
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setLatestOrderName(null), 6500);
  }, []);

  const removeOrder = useCallback((orderId: string) => {
    setOrders((current) => current.filter((order) => order.id !== orderId));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;

    let isActive = true;
    let channel: RealtimeChannel | null = null;
    setConnectionState('connecting');

    const start = async () => {
      try {
        const initialOrders = await fetchPendingOrders();
        if (!isActive) return;
        setOrders(initialOrders);
        setError(null);

        channel = subscribeToOrders({
          onPendingOrder: (order) => {
            if (!isActive) return;
            setOrders((current) => {
              if (current.some((item) => item.id === order.id)) return current;
              return [...current, order];
            });
            showIncomingAlert(order);
          },
          onOrderChanged: (orderId, status) => {
            if (isActive && status !== 'pending') removeOrder(orderId);
          },
          onConnected: () => {
            if (!isActive) return;
            setConnectionState('connected');
            setError(null);
          },
          onError: (message) => {
            if (!isActive) return;
            setConnectionState('error');
            setError(message);
          },
        });
      } catch (caughtError) {
        if (!isActive) return;
        setConnectionState('error');
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'تعذر الاتصال بـ Supabase.',
        );
      }
    };

    void start();

    return () => {
      isActive = false;
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      if (channel) void removeOrdersSubscription(channel);
    };
  }, [removeOrder, showIncomingAlert]);

  return {
    orders,
    connectionState,
    error,
    latestOrderName,
    removeOrder,
  };
}