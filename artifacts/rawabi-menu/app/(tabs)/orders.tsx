import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/constants/api";
import { useOrderBadge } from "@/context/OrderBadgeContext";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

export const ORDERS_STORAGE_KEY = "@rawabi_my_orders";

export interface StoredOrder {
  id: number;
  dailyNumber: number;
  createdAt: string;
  total: number;
  items: { name: string; quantity: number }[];
  customerName: string;
}

type OrderStatus = "pending" | "preparing" | "ready" | "done";

interface LiveOrder {
  id: number;
  status: OrderStatus;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "في الانتظار",
  preparing: "جاري التحضير",
  ready: "جاهز للاستلام",
  done: "مكتمل",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#E8920C",
  preparing: "#3B82F6",
  ready: "#22C55E",
  done: "#9A7A5A",
};

const STATUS_ICON: Record<OrderStatus, string> = {
  pending: "clock",
  preparing: "loader",
  ready: "check-circle",
  done: "archive",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const { refreshBadge } = useOrderBadge();

  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [liveStatus, setLiveStatus] = useState<Record<number, OrderStatus>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_STORAGE_KEY);
      const stored: StoredOrder[] = raw ? JSON.parse(raw) : [];
      stored.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(stored);
      refreshBadge();

      const active = stored.filter((o) => {
        const s = liveStatus[o.id];
        return !s || s === "pending" || s === "preparing" || s === "ready";
      });
      if (active.length > 0) {
        await fetchStatuses(active.map((o) => o.id));
      }
    } catch {}
  }, [liveStatus]);

  const fetchStatuses = async (ids: number[]) => {
    const results = await Promise.allSettled(
      ids.map((id) => apiGet<LiveOrder>(`/orders/${id}`))
    );
    const map: Record<number, OrderStatus> = {};
    results.forEach((r) => {
      if (r.status === "fulfilled") map[r.value.id] = r.value.status;
    });
    setLiveStatus((prev) => ({ ...prev, ...map }));
  };

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const clearAll = async () => {
    await AsyncStorage.removeItem(ORDERS_STORAGE_KEY);
    setOrders([]);
    setLiveStatus({});
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            paddingTop: topInset + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground, fontFamily: F.extra }]}>
          الطلبات
        </Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="shopping-bag" size={56} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: F.bold }]}>
            لا توجد طلبات
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            لم تقم بتنفيذ أي طلب حتى الآن!{"\n"}قم بتصفح القائمة الآن
          </Text>
          <TouchableOpacity
            style={[styles.browseBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/")}
          >
            <Text style={[styles.browseBtnText, { fontFamily: F.bold }]}>تصفح القائمة</Text>
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
            const status = liveStatus[order.id] ?? "pending";
            const isDone = status === "done";
            return (
              <View
                key={order.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: isDone ? colors.border : STATUS_COLOR[status] + "40",
                    opacity: isDone ? 0.7 : 1,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[status] + "22" }]}>
                    <Feather
                      name={STATUS_ICON[status] as any}
                      size={13}
                      color={STATUS_COLOR[status]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: STATUS_COLOR[status], fontFamily: F.bold },
                      ]}
                    >
                      {STATUS_LABEL[status]}
                    </Text>
                  </View>
                  <Text style={[styles.orderNum, { color: colors.gold, fontFamily: F.extra }]}>
                    #{order.dailyNumber}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.itemsList}>
                  {order.items.map((item, i) => (
                    <Text
                      key={i}
                      style={[styles.itemRow, { color: colors.foreground, fontFamily: F.semi }]}
                    >
                      {item.name}
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular }}>
                        {" "}× {item.quantity}
                      </Text>
                    </Text>
                  ))}
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.cardFooter}>
                  <Text style={[styles.date, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                    {formatDate(order.createdAt)}
                  </Text>
                  <Text style={[styles.total, { color: colors.gold, fontFamily: F.extra }]}>
                    {order.total % 1 === 0 ? order.total : order.total.toFixed(1)} ر.س
                  </Text>
                </View>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20 },
  clearBtn: { position: "absolute", left: 20, bottom: 14 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 26 },
  browseBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 20,
  },
  browseBtnText: { color: "#fff", fontSize: 15 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 13 },
  orderNum: { fontSize: 18 },
  divider: { height: 1 },
  itemsList: { gap: 4 },
  itemRow: { fontSize: 14, textAlign: "right" },
  cardFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  date: { fontSize: 12 },
  total: { fontSize: 16 },
});
