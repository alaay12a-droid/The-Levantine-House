import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiPatch } from "@/constants/api";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const CASHIER_PIN = "Aa@000";

type OrderStatus = "pending" | "preparing" | "ready" | "done";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "جديد",
  preparing: "قريباً يتجهز",
  ready: "جاري التجهيز",
  done: "تم التسليم",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "#E53935",
  preparing: "#FB8C00",
  ready: "#43A047",
  done: "#757575",
};

const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  ready: "done",
};

const STATUS_NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "قريبه تجهيز الطلب",
  preparing: "جاري تحضير الطلب",
  ready: "تم استلام الطلب",
};

function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const topInset = Platform.OS === "web" ? 80 : insets.top;

  const handleConfirm = () => {
    if (pin === CASHIER_PIN) {
      onSuccess();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <View style={[styles.pinContainer, { backgroundColor: colors.background, paddingTop: topInset }]}>
      <StatusBar barStyle="light-content" />
      <TouchableOpacity onPress={() => router.back()} style={styles.pinBack}>
        <Feather name="arrow-right" size={22} color={colors.mutedForeground} />
      </TouchableOpacity>
      <Text style={[styles.pinTitle, { color: colors.foreground, fontFamily: F.extra }]}>
        🔐 لوحة الكاشير
      </Text>
      <Text style={[styles.pinSubtitle, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        أدخل رمز الدخول
      </Text>
      <TextInput
        style={[styles.pinInput, { backgroundColor: colors.card, borderColor: error ? "#E53935" : colors.border, color: colors.foreground, fontFamily: F.bold }]}
        value={pin}
        onChangeText={(t) => { setPin(t); setError(false); }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="••••••"
        placeholderTextColor={colors.mutedForeground}
        onSubmitEditing={handleConfirm}
        returnKeyType="done"
      />
      {error && (
        <Text style={[styles.pinError, { fontFamily: F.semi }]}>رمز خاطئ، حاول مجدداً</Text>
      )}
      <TouchableOpacity
        onPress={handleConfirm}
        style={[styles.pinConfirmBtn, { backgroundColor: colors.gold }]}
        activeOpacity={0.8}
      >
        <Text style={[styles.pinConfirmText, { color: "#1A0A00", fontFamily: F.extra }]}>دخول</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CashierScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const topInset = Platform.OS === "web" ? 60 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<Order[]>("/orders");
      setOrders(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 10000);
    return () => clearInterval(interval);
  }, [authenticated, fetchOrders]);

  const handleUpdateStatus = async (order: Order, newStatus: OrderStatus) => {
    try {
      const updated = await apiPatch<Order>(`/orders/${order.id}/status`, { status: newStatus });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch {
      Alert.alert("خطأ", "تعذر تحديث الحالة");
    }
  };

  if (!authenticated) {
    return <PinScreen onSuccess={() => setAuthenticated(true)} />;
  }

  const filtered = filter === "all"
    ? orders.filter((o) => o.status !== "done")
    : orders.filter((o) => o.status === filter);

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { backgroundColor: "#1A1008", paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.bold }]}>
            لوحة الكاشير
          </Text>
          {pendingCount > 0 && (
            <View style={[styles.badge, { backgroundColor: "#E53935" }]}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.push("/admin-menu")}
            style={[styles.adminMenuBtn, { backgroundColor: colors.gold }]}
          >
            <Feather name="settings" size={15} color="#1A0A00" />
            <Text style={{ color: "#1A0A00", fontFamily: "Cairo_700Bold", fontSize: 13 }}>إدارة القائمة</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => fetchOrders()} style={[styles.refreshBtn, { backgroundColor: colors.secondary }]}>
            <Feather name="refresh-cw" size={18} color={colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
        style={{ backgroundColor: "#1A1008" }}
      >
        {([["all", "الكل"], ["pending", "جديد"], ["preparing", "جاري التحضير"], ["ready", "جاهز"], ["done", "تم"]] as [string, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key as OrderStatus | "all")}
            style={[
              styles.filterTab,
              {
                backgroundColor: filter === key ? colors.gold : colors.secondary,
                borderColor: filter === key ? colors.gold : colors.border,
              },
            ]}
          >
            <Text style={[styles.filterTabText, { color: filter === key ? "#1A1008" : colors.mutedForeground, fontFamily: F.bold }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 48 }}>🍽️</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            لا توجد طلبات
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.ordersList, { paddingBottom: bottomInset + 20 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(); }}
              tintColor={colors.gold}
            />
          }
        >
          {filtered.map((order) => {
            const nextStatus = STATUS_NEXT[order.status];
            const nextLabel = STATUS_NEXT_LABEL[order.status];
            const time = new Date(order.createdAt).toLocaleTimeString("ar-SA", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const total = (order.totalPrice / 100).toFixed(2);
            return (
              <View key={order.id} style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] + "22", borderColor: STATUS_COLORS[order.status] }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[order.status], fontFamily: F.bold }]}>
                      {STATUS_LABELS[order.status]}
                    </Text>
                  </View>
                  <View style={styles.orderMeta}>
                    <Text style={[styles.orderId, { color: colors.gold, fontFamily: F.extra }]}>
                      #{order.id}
                    </Text>
                    <Text style={[styles.orderTime, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                      {time}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.customerRow}>
                    <Text style={[styles.customerName, { color: colors.foreground, fontFamily: F.bold }]}>
                      {order.customerName}
                    </Text>
                    <Feather name="user" size={14} color={colors.mutedForeground} />
                  </View>
                  <View style={styles.customerRow}>
                    <Text style={[styles.customerPhone, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                      {order.customerPhone}
                    </Text>
                    <Feather name="phone" size={14} color={colors.mutedForeground} />
                  </View>
                  {order.customerAddress && (
                    <View style={styles.customerRow}>
                      <Text style={[styles.customerPhone, { color: colors.mutedForeground, fontFamily: F.regular }]} numberOfLines={1}>
                        {order.customerAddress}
                      </Text>
                      <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                    </View>
                  )}
                </View>

                <View style={[styles.itemsList, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                  {order.items.map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={[styles.itemPrice, { color: colors.gold, fontFamily: F.bold }]}>
                        {(item.price * item.quantity) % 1 === 0
                          ? (item.price * item.quantity)
                          : (item.price * item.quantity).toFixed(1)} ر.س
                      </Text>
                      <Text style={[styles.itemName, { color: colors.foreground, fontFamily: F.semi }]} numberOfLines={1}>
                        {item.name} × {item.quantity}
                      </Text>
                    </View>
                  ))}
                </View>

                {order.notes && (
                  <View style={[styles.notesRow, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.notesLabel, { color: colors.gold, fontFamily: F.bold }]}>ملاحظة: </Text>
                    <Text style={[styles.notesText, { color: colors.foreground, fontFamily: F.regular }]}>{order.notes}</Text>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <Text style={[styles.totalAmount, { color: colors.gold, fontFamily: F.extra }]}>
                    {total} ر.س
                  </Text>
                  <Text style={[styles.payMethod, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                    {order.paymentMethod === "cash" ? "💵 نقدي" : "💳 إلكتروني"}
                  </Text>
                </View>

                {nextStatus && nextLabel && (
                  <TouchableOpacity
                    onPress={() => handleUpdateStatus(order, nextStatus)}
                    style={[styles.actionBtn, { backgroundColor: STATUS_COLORS[nextStatus] }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.actionBtnText, { fontFamily: F.bold }]}>{nextLabel}</Text>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerTitle: { fontSize: 20 },
  badge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  adminMenuBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  filterTabs: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterTabText: { fontSize: 13 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16 },
  ordersList: { padding: 12, gap: 12 },
  orderCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 13 },
  orderMeta: { alignItems: "flex-end", gap: 2 },
  orderId: { fontSize: 18 },
  orderTime: { fontSize: 12 },
  cardBody: { padding: 12, gap: 6 },
  customerRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  customerName: { fontSize: 16 },
  customerPhone: { fontSize: 13 },
  itemsList: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, gap: 6 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemName: { flex: 1, fontSize: 14, textAlign: "right" },
  itemPrice: { fontSize: 14, minWidth: 60, textAlign: "left" },
  notesRow: {
    flexDirection: "row",
    padding: 10,
    paddingHorizontal: 12,
    flexWrap: "wrap",
  },
  notesLabel: { fontSize: 13 },
  notesText: { fontSize: 13, flex: 1 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  totalAmount: { fontSize: 20 },
  payMethod: { fontSize: 13 },
  actionBtn: {
    margin: 12,
    marginTop: 0,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  actionBtnText: { color: "#fff", fontSize: 16 },
  pinContainer: { flex: 1, alignItems: "center", paddingTop: 40, padding: 24 },
  pinBack: { alignSelf: "flex-start", marginBottom: 20, padding: 4 },
  pinTitle: { fontSize: 26, marginBottom: 8 },
  pinSubtitle: { fontSize: 15, marginBottom: 24 },
  pinInput: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 10,
  },
  pinError: { color: "#E53935", fontSize: 14, marginBottom: 10 },
  pinConfirmBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  pinConfirmText: { fontSize: 18 },
});
