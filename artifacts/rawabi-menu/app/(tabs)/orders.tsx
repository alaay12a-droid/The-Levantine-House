import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiPatch } from "@/constants/api";
import { useOrderBadge } from "@/context/OrderBadgeContext";
import { useLanguage } from "@/context/LanguageContext";

const F = {
  regular: "Cairo_400Regular",
  semi:    "Cairo_600SemiBold",
  bold:    "Cairo_700Bold",
  extra:   "Cairo_800ExtraBold",
};

export const ORDERS_STORAGE_KEY      = "@rawabi_my_orders";
const        LIVE_STATUS_STORAGE_KEY = "@rawabi_live_status";
const        POLL_INTERVAL_MS        = 12_000; // 12 seconds

export interface StoredOrder {
  id:           number;
  dailyNumber:  number;
  createdAt:    string;
  total:        number;
  items:        { name: string; quantity: number }[];
  customerName: string;
}

type OrderStatus = "pending" | "preparing" | "ready" | "done" | "cancelled";

interface LiveOrder {
  id:     number;
  status: OrderStatus;
}

const STATUS_LABEL_AR: Record<OrderStatus, string> = {
  pending:   "في الانتظار",
  preparing: "جاري التحضير",
  ready:     "جاهز للاستلام",
  done:      "مكتمل",
  cancelled: "ملغى",
};

const STATUS_LABEL_EN: Record<OrderStatus, string> = {
  pending:   "Pending",
  preparing: "Preparing",
  ready:     "Ready for Pickup",
  done:      "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending:   "#E8920C",
  preparing: "#3B82F6",
  ready:     "#22C55E",
  done:      "#9A7A5A",
  cancelled: "#E53935",
};

const STATUS_ICON: Record<OrderStatus, string> = {
  pending:   "clock",
  preparing: "loader",
  ready:     "check-circle",
  done:      "archive",
  cancelled: "x-circle",
};

function formatDate(iso: string, isEn: boolean) {
  const d = new Date(iso);
  return d.toLocaleDateString(isEn ? "en-US" : "ar-SA", {
    day:    "numeric",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const { refreshBadge } = useOrderBadge();
  const { language } = useLanguage();
  const isEn = language === "en";

  const [orders, setOrders]           = useState<StoredOrder[]>([]);
  const [liveStatus, setLiveStatus]   = useState<Record<number, OrderStatus>>({});
  const [refreshing, setRefreshing]   = useState(false);
  const [allowCancel, setAllowCancel] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelBanner, setCancelBanner] = useState<{ orderNum: number; name: string } | null>(null);

  const ordersRef    = useRef<StoredOrder[]>([]);
  const liveRef      = useRef<Record<number, OrderStatus>>({});
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenActive = useRef(false);
  const bannerAnim   = useRef(new Animated.Value(0)).current;
  const bannerTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCancelBanner = useCallback((orderNum: number, name: string) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setCancelBanner({ orderNum, name });
    Animated.spring(bannerAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    bannerTimer.current = setTimeout(() => {
      Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setCancelBanner(null);
      });
    }, 5000);
  }, [bannerAnim]);

  // ── persist live-status cache to storage ──────────────────────────────────
  const saveLiveStatus = useCallback(async (map: Record<number, OrderStatus>) => {
    try {
      await AsyncStorage.setItem(LIVE_STATUS_STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }, []);

  // ── load cached live-status from storage (instant, no flash) ─────────────
  const loadCachedStatus = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(LIVE_STATUS_STORAGE_KEY);
      if (raw) {
        const map: Record<number, OrderStatus> = JSON.parse(raw);
        liveRef.current = { ...liveRef.current, ...map };
        setLiveStatus((prev) => ({ ...map, ...prev }));
      }
    } catch {}
  }, []);

  // ── fetch live statuses for a list of order IDs ───────────────────────────
  const fetchStatuses = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) => apiGet<LiveOrder>(`/orders/${id}`))
    );
    const map: Record<number, OrderStatus> = {};
    results.forEach((r) => {
      if (r.status === "fulfilled") map[r.value.id] = r.value.status;
    });

    // ── detect newly-cancelled orders and alert the customer ──────────────
    for (const [idStr, newStatus] of Object.entries(map)) {
      const id        = Number(idStr);
      const oldStatus = liveRef.current[id];
      if (newStatus === "cancelled" && oldStatus && oldStatus !== "cancelled") {
        const order = ordersRef.current.find((o) => o.id === id);
        if (order) {
          showCancelBanner(order.dailyNumber, order.customerName);
          // Also fire a local system notification (works on native even in background)
          if (Platform.OS !== "web") {
            Notifications.scheduleNotificationAsync({
              content: {
                title: "❌ تم إلغاء طلبك",
                body: `نأسف، تم إلغاء طلبك رقم #${order.dailyNumber} من قِبل المطعم.`,
                sound: "default",
              },
              trigger: null,
            }).catch(() => {});
          }
        }
      }
    }

    const merged = { ...liveRef.current, ...map };
    liveRef.current = merged;
    setLiveStatus(merged);
    await saveLiveStatus(merged);
    refreshBadge();
  }, [saveLiveStatus, refreshBadge, showCancelBanner]);

  // ── IDs of orders that are still "alive" (need polling) ──────────────────
  const getActiveIds = useCallback(() => {
    return ordersRef.current
      .filter((o) => {
        const s = liveRef.current[o.id];
        return !s || s === "pending" || s === "preparing" || s === "ready";
      })
      .map((o) => o.id);
  }, []);

  // ── one polling tick ──────────────────────────────────────────────────────
  const pollTick = useCallback(async () => {
    const ids = getActiveIds();
    if (ids.length > 0) await fetchStatuses(ids);
  }, [getActiveIds, fetchStatuses]);

  // ── start / stop polling ──────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(pollTick, POLL_INTERVAL_MS);
  }, [pollTick]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ── load orders from AsyncStorage + initial status fetch ─────────────────
  const loadOrders = useCallback(async () => {
    try {
      const raw     = await AsyncStorage.getItem(ORDERS_STORAGE_KEY);
      const stored: StoredOrder[] = raw ? JSON.parse(raw) : [];
      stored.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      ordersRef.current = stored;
      setOrders(stored);

      apiGet<{ allowed: boolean }>("/settings/customer-cancel")
        .then((r) => setAllowCancel(r.allowed))
        .catch(() => {});

      const ids = stored
        .filter((o) => {
          const s = liveRef.current[o.id];
          return !s || s === "pending" || s === "preparing" || s === "ready";
        })
        .map((o) => o.id);

      if (ids.length > 0) await fetchStatuses(ids);
    } catch {}
  }, [fetchStatuses]);

  // ── screen focus / blur lifecycle ────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      screenActive.current = true;

      // 1. show cached statuses instantly (no pending flash)
      loadCachedStatus().then(() => {
        // 2. then fetch fresh from server + start polling
        loadOrders().then(() => {
          if (screenActive.current) startPolling();
        });
      });

      return () => {
        screenActive.current = false;
        stopPolling();
      };
    }, [loadCachedStatus, loadOrders, startPolling, stopPolling])
  );

  // cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const cancelOrder = async (id: number) => {
    setCancellingId(id);
    try {
      const updated = await apiPatch<LiveOrder>(`/orders/${id}/cancel`, {});
      const merged  = { ...liveRef.current, [id]: updated.status };
      liveRef.current = merged;
      setLiveStatus(merged);
      await saveLiveStatus(merged);
      refreshBadge();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : isEn ? "An error occurred" : "حدث خطأ";
      Alert.alert(isEn ? "Cancellation Failed" : "تعذّر الإلغاء", msg);
    } finally {
      setCancellingId(null);
    }
  };

  const STATUS_LABEL = isEn ? STATUS_LABEL_EN : STATUS_LABEL_AR;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { backgroundColor: colors.card, paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: F.extra }]}>
          {isEn ? "Orders" : "الطلبات"}
        </Text>
      </View>

      {/* ── Cancellation Banner ── */}
      {cancelBanner && (
        <Animated.View
          style={{
            transform: [{
              translateY: bannerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-80, 0],
              }),
            }],
            opacity: bannerAnim,
            position: "absolute",
            top: topInset + 62,
            left: 12,
            right: 12,
            zIndex: 999,
            backgroundColor: "#1A0808",
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: "#E5393588",
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            shadowColor: "#E53935",
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#E5393520", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 20 }}>❌</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: "#EF4444", fontFamily: F.bold, fontSize: 14, textAlign: "right" }}>
              {isEn ? "Order Cancelled" : "تم إلغاء طلبك"}
            </Text>
            <Text style={{ color: "#9A7A7A", fontFamily: F.regular, fontSize: 12, textAlign: "right" }}>
              {isEn
                ? `Order #${cancelBanner.orderNum} has been cancelled by the restaurant`
                : `طلبك رقم #${cancelBanner.orderNum} تم إلغاؤه من قِبل المطعم`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => {
            if (bannerTimer.current) clearTimeout(bannerTimer.current);
            Animated.timing(bannerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setCancelBanner(null));
          }}>
            <Feather name="x" size={16} color="#9A7A7A" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {orders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <Feather name="shopping-bag" size={44} color={colors.border} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: F.bold }]}>
            {isEn ? "No Orders Yet" : "لا توجد طلبات"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            {isEn ? "Browse the menu and place your first order!" : "تصفح القائمة وضع طلبك الأول!"}
          </Text>
          <TouchableOpacity
            style={[styles.browseBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/")}
          >
            <Text style={[styles.browseBtnText, { fontFamily: F.bold }]}>
              {isEn ? "Browse Menu" : "تصفح القائمة"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
        >
          {orders.map((order) => {
            const status      = liveStatus[order.id] ?? "pending";
            const isDone      = status === "done" || status === "cancelled";
            const isCancelling = cancellingId === order.id;
            const statusColor = STATUS_COLOR[status];

            return (
              <View
                key={order.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: isDone ? colors.border : statusColor + "40",
                    opacity: isDone ? 0.75 : 1,
                  },
                ]}
              >
                {/* Card header: order # + status badge */}
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                    <Feather name={STATUS_ICON[status] as any} size={13} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor, fontFamily: F.bold }]}>
                      {STATUS_LABEL[status]}
                    </Text>
                  </View>
                  <Text style={[styles.orderNum, { color: colors.gold, fontFamily: F.extra }]}>
                    #{order.dailyNumber}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Items */}
                <View style={styles.itemsList}>
                  {order.items.map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={[styles.itemQty, { color: colors.gold, fontFamily: F.bold }]}>
                        ×{item.quantity}
                      </Text>
                      <Text style={[styles.itemName, { color: colors.foreground, fontFamily: F.semi }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Footer: date + total */}
                <View style={styles.cardFooter}>
                  <Text style={[styles.total, { color: colors.gold, fontFamily: F.extra }]}>
                    {order.total % 1 === 0 ? order.total : order.total.toFixed(1)} {isEn ? "SAR" : "ر.س"}
                  </Text>
                  <Text style={[styles.date, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                    {formatDate(order.createdAt, isEn)}
                  </Text>
                </View>

                {/* Cancel button */}
                {allowCancel && status === "pending" && (
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: "#E53935" + "60", backgroundColor: "#E5393510" }]}
                    onPress={() =>
                      Alert.alert(
                        isEn ? "Cancel Order" : "إلغاء الطلب",
                        isEn ? "Do you want to cancel this order?" : "هل تريد إلغاء هذا الطلب؟",
                        [
                          { text: isEn ? "No" : "لا", style: "cancel" },
                          { text: isEn ? "Yes, Cancel" : "نعم، إلغاء", style: "destructive", onPress: () => cancelOrder(order.id) },
                        ]
                      )
                    }
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <ActivityIndicator size="small" color="#E53935" />
                    ) : (
                      <>
                        <Feather name="x-circle" size={15} color="#E53935" />
                        <Text style={[styles.cancelBtnText, { fontFamily: F.bold }]}>
                          {isEn ? "Cancel Order" : "إلغاء الطلب"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom:     14,
    borderBottomWidth: 1,
    alignItems:        "center",
  },
  title: { fontSize: 20 },

  emptyWrap: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    gap:               14,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width:          90,
    height:         90,
    borderRadius:   45,
    alignItems:     "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 20, marginTop: 4 },
  emptyText:  { fontSize: 14, textAlign: "center", lineHeight: 24 },
  browseBtn: {
    marginTop:         6,
    paddingHorizontal: 32,
    paddingVertical:   13,
    borderRadius:      14,
  },
  browseBtnText: { color: "#fff", fontSize: 15 },

  card: {
    borderRadius: 16,
    borderWidth:  1,
    overflow:     "hidden",
  },
  cardHeader: {
    flexDirection:   "row-reverse",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  statusBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    borderRadius:      20,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  statusText: { fontSize: 13 },
  orderNum:   { fontSize: 20 },

  divider: { height: 1 },

  itemsList: {
    paddingHorizontal: 14,
    paddingVertical:   10,
    gap:               6,
  },
  itemRow: {
    flexDirection: "row-reverse",
    alignItems:    "center",
    gap:           8,
  },
  itemQty:  { fontSize: 13 },
  itemName: { fontSize: 14, flex: 1, textAlign: "right" },

  cardFooter: {
    flexDirection:     "row-reverse",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  total: { fontSize: 17 },
  date:  { fontSize: 12 },

  cancelBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    borderWidth:    1,
    borderRadius:   0,
    paddingVertical: 10,
  },
  cancelBtnText: { color: "#E53935", fontSize: 14 },
});
