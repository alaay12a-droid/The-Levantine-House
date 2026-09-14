import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { fetchPrinterOrders } from '@/services/levantineApi/orders';
import {
  loadPrintedOrderIds,
  savePrintedOrderId,
} from '@/services/printedOrders';
import { printOrderReceipt } from '@/services/sunmiPrinter';
import type { RemoteOrder } from '@/types/remoteOrder';
import type { PrinterLogLevel } from '@/services/sunmiPrinter';

const POLL_INTERVAL_MS = 5000;
const RETRY_DELAY_MS = 30000;
const RIYADH_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function isTodayInRiyadh(date: string): boolean {
  return (
    RIYADH_DATE_FORMATTER.format(new Date(date)) ===
    RIYADH_DATE_FORMATTER.format(new Date())
  );
}

export type PrinterLogEntry = {
  id: number;
  at: Date;
  level: PrinterLogLevel;
  message: string;
};

export function useAutomaticOrderPrinter() {
  const alertPlayer = useAudioPlayer(
    require('../assets/order-alert.wav'),
    { updateInterval: 500 },
  );
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [lastPrintedOrder, setLastPrintedOrder] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printerLogs, setPrinterLogs] = useState<PrinterLogEntry[]>([]);
  const printedIdsRef = useRef<Set<number>>(new Set());
  const inFlightIds = useRef<Set<number>>(new Set());
  const retryAfter = useRef<Map<number, number>>(new Map());
  const pollRunning = useRef(false);
  const mounted = useRef(true);
  const logSequence = useRef(0);
  const lastQueueFingerprint = useRef('');
  const silencedPendingIds = useRef<Set<number>>(new Set());
  const [pendingAlertIds, setPendingAlertIds] = useState<number[]>([]);
  const [silencedRevision, setSilencedRevision] = useState(0);
  const activePendingAlertIds = pendingAlertIds.filter(
    (id) => !silencedPendingIds.current.has(id),
  );
  const isOrderAlertActive = activePendingAlertIds.length > 0;

  const silenceOrderAlert = useCallback((orderId: number) => {
    silencedPendingIds.current.add(orderId);
    setSilencedRevision((revision) => revision + 1);
  }, []);

  const resumeOrderAlert = useCallback((orderId: number) => {
    silencedPendingIds.current.delete(orderId);
    setSilencedRevision((revision) => revision + 1);
  }, []);

  const addPrinterLog = useCallback(
    (level: PrinterLogLevel, message: string) => {
      const entry: PrinterLogEntry = {
        id: ++logSequence.current,
        at: new Date(),
        level,
        message,
      };
      setPrinterLogs((current) => [entry, ...current].slice(0, 30));
    },
    [],
  );

  const poll = useCallback(async () => {
    if (pollRunning.current) return;
    pollRunning.current = true;

    try {
      const allOrders = await fetchPrinterOrders();
      const acceptedOrders = allOrders.filter(
        (order) => order.status === 'preparing',
      );
      const currentPendingIds = allOrders
        .filter(
          (order) =>
            order.status === 'pending' && isTodayInRiyadh(order.createdAt),
        )
        .map((order) => order.id);
      const currentPendingSet = new Set(currentPendingIds);
      for (const id of silencedPendingIds.current) {
        if (!currentPendingSet.has(id)) silencedPendingIds.current.delete(id);
      }
      setPendingAlertIds(currentPendingIds);
      if (!mounted.current) return;
      setIsConnected(true);

      const unprinted = acceptedOrders.filter(
        (order) => !printedIdsRef.current.has(order.id),
      );
      setOrders(unprinted);
      const queueFingerprint = unprinted.map((order) => order.id).join(',');
      if (
        unprinted.length > 0 &&
        queueFingerprint !== lastQueueFingerprint.current
      ) {
        addPrinterLog(
          'info',
          `اكتُشف ${unprinted.length} طلب غير مطبوع بحالة preparing.`,
        );
      }
      lastQueueFingerprint.current = queueFingerprint;

      if (Platform.OS !== 'android') return;

      for (const order of unprinted) {
        if (inFlightIds.current.has(order.id)) continue;
        if ((retryAfter.current.get(order.id) ?? 0) > Date.now()) continue;

        inFlightIds.current.add(order.id);
        setActiveOrderId(order.id);
        addPrinterLog(
          'info',
          `بدء محاولة طباعة الطلب #${order.dailyNumber ?? order.id} (id=${order.id}).`,
        );
        Vibration.vibrate([0, 250, 120, 250]);

        try {
          await printOrderReceipt(
            {
              orderNumber: order.dailyNumber ?? order.id,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              customerAddress: order.customerAddress ?? 'استلام من الفرع',
              items: order.items,
              total: order.total,
              deliveryFee: order.deliveryFee,
              notes: order.notes ?? undefined,
              printedAt: new Date(),
            },
            addPrinterLog,
          );
          printedIdsRef.current = await savePrintedOrderId(
            printedIdsRef.current,
            order.id,
          );
          retryAfter.current.delete(order.id);
          setOrders((current) =>
            current.filter((item) => item.id !== order.id),
          );
          setLastPrintedOrder(order.dailyNumber ?? order.id);
          setError(null);
          addPrinterLog(
            'success',
            `نجحت طباعة الطلب #${order.dailyNumber ?? order.id} وتم حفظه محليًا.`,
          );
        } catch (printError) {
          retryAfter.current.set(order.id, Date.now() + RETRY_DELAY_MS);
          const message =
            printError instanceof Error
              ? printError.message
              : String(printError);
          setError(message);
          addPrinterLog(
            'error',
            `الطلب #${order.dailyNumber ?? order.id}: ${message}. إعادة المحاولة بعد 30 ثانية.`,
          );
        } finally {
          inFlightIds.current.delete(order.id);
          setActiveOrderId(null);
        }
      }
    } catch (pollError) {
      if (!mounted.current) return;
      setIsConnected(false);
      const message =
        pollError instanceof Error
          ? pollError.message
          : 'تعذر الاتصال بخادم البيت الشامي.';
      setError(message);
      addPrinterLog('error', `خطأ اتصال API: ${message}`);
    } finally {
      pollRunning.current = false;
    }
  }, [addPrinterLog]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    alertPlayer.loop = true;
    if (isOrderAlertActive) {
      void setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      })
        .then(() => {
          alertPlayer.play();
          Vibration.vibrate([0, 500, 600], true);
        })
        .catch((audioError: unknown) => {
          addPrinterLog(
            'error',
            `تعذر تشغيل تنبيه الطلب: ${
              audioError instanceof Error
                ? audioError.message
                : String(audioError)
            }`,
          );
        });
      return;
    }

    alertPlayer.pause();
    void alertPlayer.seekTo(0);
    Vibration.cancel();
  }, [
    addPrinterLog,
    alertPlayer,
    isOrderAlertActive,
    silencedRevision,
  ]);

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
      alertPlayer.pause();
      Vibration.cancel();
    };
  }, [alertPlayer, poll]);

  return {
    orders,
    isConnected,
    activeOrderId,
    lastPrintedOrder,
    error,
    printerLogs,
    isOrderAlertActive,
    pendingAlertCount: activePendingAlertIds.length,
    silenceOrderAlert,
    resumeOrderAlert,
    isPreview: Platform.OS === 'web',
  };
}