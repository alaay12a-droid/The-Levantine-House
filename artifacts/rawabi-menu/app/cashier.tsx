import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Modal,
  Share,
  Clipboard,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { loadPins, isMasterCode } from "@/hooks/usePins";
import { useNotifications } from "@/hooks/useNotifications";
import { apiGet, apiPatch, apiPut } from "@/constants/api";
import { type ApiMenuItem } from "@/hooks/useMenu";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const CASHIER_PIN_DEFAULT = "Aa@000";

const CATEGORIES = [
  { id: "chicken",  name: "الدجاج",   icon: "🍗" },
  { id: "meat",     name: "اللحوم",   icon: "🥩" },
  { id: "rice",     name: "الأرز",    icon: "🍚" },
  { id: "sides",    name: "الجانبية", icon: "🥗" },
  { id: "drinks",   name: "المشروبات",icon: "🥤" },
  { id: "desserts", name: "الحلويات", icon: "🍮" },
];

type OrderStatus = "pending" | "preparing" | "ready" | "done";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  dailyNumber: number;
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

function PinScreen({ onSuccess, correctPin }: { onSuccess: () => void; correctPin: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const topInset = Platform.OS === "web" ? 80 : insets.top;

  const handleConfirm = () => {
    if (pin === correctPin || isMasterCode(pin)) {
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
  useNotifications();

  const [authenticated, setAuthenticated] = useState(false);
  const [cashierPin, setCashierPin] = useState(CASHIER_PIN_DEFAULT);
  const [pinsLoaded, setPinsLoaded] = useState(false);

  React.useEffect(() => {
    loadPins().then((p) => { setCashierPin(p.cashier); setPinsLoaded(true); });
  }, []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── Stock state ───────────────────────────────────────
  const [showStockModal, setShowStockModal] = useState(false);
  const [menuItems, setMenuItems] = useState<ApiMenuItem[]>([]);
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [stockSaving, setStockSaving] = useState<string | null>(null);

  const fetchMenuItems = useCallback(async () => {
    try {
      const data = await apiGet<ApiMenuItem[]>("/menu");
      setMenuItems(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (showStockModal) fetchMenuItems();
  }, [showStockModal, fetchMenuItems]);

  const getStockEditValue = (item: ApiMenuItem): string => {
    if (item.itemId in stockEdits) return stockEdits[item.itemId];
    return item.stock === null ? "" : String(item.stock);
  };

  const adjustStock = (item: ApiMenuItem, delta: number) => {
    const current = getStockEditValue(item);
    const next = Math.max(0, (current === "" ? 0 : parseInt(current) || 0) + delta);
    setStockEdits((prev) => ({ ...prev, [item.itemId]: String(next) }));
  };

  const handleQuickStock = async (itemId: string, rawVal: string) => {
    const val = rawVal.trim();
    const stock = val === "" ? null : parseInt(val);
    if (stock !== null && (isNaN(stock) || stock < 0)) return;
    setStockSaving(itemId);
    try {
      await apiPut(`/menu/${itemId}`, { stock });
      await fetchMenuItems();
      setStockEdits((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
    } catch {
      Alert.alert("خطأ", "تعذر تحديث المخزون");
    } finally {
      setStockSaving(null);
    }
  };
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const knownOrderIds = useRef<Set<number>>(new Set());
  const soundEnabled = useRef(false);

  const playNotificationSound = useCallback(() => {
    try {
      if (Platform.OS !== "web") return;
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [880, 1108, 1320];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch { /* silent */ }
  }, []);

  const customerUrl = Platform.OS === "web"
    ? (typeof window !== "undefined" ? window.location.origin + "/" : "")
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}/`;

  const handleCopyLink = () => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(customerUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    } else {
      Clipboard.setString(customerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareLink = async () => {
    try {
      await Share.share({ message: `اطلب من روابي المندي: ${customerUrl}`, url: customerUrl });
    } catch { /* silent */ }
  };

  const topInset = Platform.OS === "web" ? 60 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<Order[]>("/orders");
      const newPending = data.filter((o) => o.status === "pending");

      if (silent && soundEnabled.current) {
        const newOnes = newPending.filter((o) => !knownOrderIds.current.has(o.id));
        if (newOnes.length > 0) {
          playNotificationSound();
          setHasNewOrder(true);
          setTimeout(() => setHasNewOrder(false), 4000);
        }
      }

      newPending.forEach((o) => knownOrderIds.current.add(o.id));

      if (Platform.OS === "web" && typeof document !== "undefined") {
        const pendingCount = newPending.length;
        document.title = pendingCount > 0
          ? `(${pendingCount}) طلب جديد 🔔 | الكاشير`
          : "الكاشير | روابي المندي";
      }

      setOrders(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playNotificationSound]);

  useEffect(() => {
    if (!authenticated) return;
    fetchOrders();
    const initTimer = setTimeout(() => { soundEnabled.current = true; }, 2000);
    const interval = setInterval(() => fetchOrders(true), 10000);
    return () => {
      clearInterval(interval);
      clearTimeout(initTimer);
      if (Platform.OS === "web" && typeof document !== "undefined") {
        document.title = "روابي المندي";
      }
    };
  }, [authenticated, fetchOrders]);

  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  const handlePrint = (order: Order) => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const date = new Date(order.createdAt);
    const dateStr = date.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
    const timeStr = date.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    const itemsRows = order.items.map((item) => {
      const lineTotal = (item.price * item.quantity);
      const lineTotalStr = lineTotal % 1 === 0 ? String(lineTotal) : lineTotal.toFixed(2);
      return `
        <tr>
          <td style="padding:4px 8px;text-align:left;">${lineTotalStr} ر.س</td>
          <td style="padding:4px 8px;text-align:right;">${item.name}</td>
          <td style="padding:4px 8px;text-align:center;">${item.quantity}</td>
        </tr>`;
    }).join("");
    const total = (order.totalPrice / 100).toFixed(2);
    const payMethod = order.paymentMethod === "cash" ? "نقدي" : "إلكتروني";
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>إيصال الطلب</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo',sans-serif; background:#fff; color:#111; direction:rtl; }
  .receipt { max-width:80mm; margin:0 auto; padding:10mm 5mm; }
  .logo { text-align:center; margin-bottom:8px; }
  .logo h1 { font-size:20px; font-weight:800; color:#8B4513; }
  .logo p { font-size:12px; color:#666; }
  .divider { border:none; border-top:1px dashed #bbb; margin:8px 0; }
  .meta { font-size:12px; margin-bottom:6px; }
  .meta span { color:#555; }
  .daily-num { text-align:center; font-size:18px; font-weight:800; margin:6px 0; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  thead th { border-bottom:1px solid #ccc; padding:4px 8px; font-weight:700; }
  .total-row { font-size:15px; font-weight:800; }
  .total-row td { padding:8px; border-top:1px solid #aaa; }
  .footer { text-align:center; font-size:11px; color:#888; margin-top:10px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    button { display:none !important; }
  }
</style>
</head>
<body>
<div class="receipt">
  <div class="logo">
    <h1>🍗 روابي المندي</h1>
    <p>تبوك - المملكة العربية السعودية</p>
  </div>
  <hr class="divider"/>
  <div class="daily-num">طلب اليوم #${order.dailyNumber}</div>
  <hr class="divider"/>
  <div class="meta"><span>الاسم:</span> ${order.customerName}</div>
  <div class="meta"><span>الجوال:</span> ${order.customerPhone}</div>
  ${order.customerAddress ? `<div class="meta"><span>العنوان:</span> ${order.customerAddress.startsWith("https://") ? "موقع GPS" : order.customerAddress}</div>` : ""}
  <div class="meta"><span>التاريخ:</span> ${dateStr}</div>
  <div class="meta"><span>الوقت:</span> ${timeStr}</div>
  <div class="meta"><span>الدفع:</span> ${payMethod}</div>
  ${order.notes ? `<div class="meta"><span>ملاحظات:</span> ${order.notes}</div>` : ""}
  <hr class="divider"/>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">الإجمالي</th>
        <th style="text-align:right;">الصنف</th>
        <th style="text-align:center;">الكمية</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3" style="text-align:center;">الإجمالي: ${total} ر.س</td>
      </tr>
    </tfoot>
  </table>
  <hr class="divider"/>
  <div class="footer">شكراً لاختيارك روابي المندي 🍗<br/>نتمنى لك وجبة شهية!</div>
</div>
<script>
  window.onload = function() { window.print(); };
</script>
</body>
</html>`;
    const win = window.open("", "_blank", "width=400,height=600");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleUpdateStatus = async (order: Order, newStatus: OrderStatus) => {
    try {
      const updated = await apiPatch<Order>(`/orders/${order.id}/status`, { status: newStatus });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (newStatus === "preparing") {
        setPrintOrder(updated);
      }
    } catch {
      Alert.alert("خطأ", "تعذر تحديث الحالة");
    }
  };

  if (!pinsLoaded) return null;
  if (!authenticated) {
    return <PinScreen onSuccess={() => setAuthenticated(true)} correctPin={cashierPin} />;
  }

  const filtered = filter === "all"
    ? orders.filter((o) => o.status !== "done")
    : orders.filter((o) => o.status === filter);

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { backgroundColor: "#1A1008", paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={[styles.backBtn, { backgroundColor: colors.secondary }]}>
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
            onPress={() => setShowStockModal(true)}
            style={[styles.adminMenuBtn, { backgroundColor: "#1A2A3A" }]}
          >
            <Feather name="package" size={15} color="#64B5F6" />
            <Text style={{ color: "#64B5F6", fontFamily: "Cairo_700Bold", fontSize: 13 }}>المخزون</Text>
          </TouchableOpacity>
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

      {/* New Order Alert Banner */}
      {hasNewOrder && (
        <View style={{ backgroundColor: "#E53935", paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
          <Text style={{ color: "#fff", fontFamily: "Cairo_800ExtraBold", fontSize: 16, letterSpacing: 0.5 }}>
            طلب جديد وصل!
          </Text>
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </View>
      )}

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
            const orderDate = new Date(order.createdAt);
            const time = orderDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
            const dateStr = orderDate.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={[styles.dailyBadge, { backgroundColor: colors.gold + "22", borderColor: colors.gold }]}>
                        <Text style={[styles.dailyNumber, { color: colors.gold, fontFamily: F.extra }]}>
                          طلب اليوم #{order.dailyNumber}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Text style={[styles.orderTime, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                        {time}
                      </Text>
                      <Text style={[styles.orderDate, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                        {dateStr}
                      </Text>
                    </View>
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
                    <TouchableOpacity
                      style={styles.customerRow}
                      onPress={() => order.customerAddress?.startsWith("https://") ? Linking.openURL(order.customerAddress) : undefined}
                      activeOpacity={order.customerAddress.startsWith("https://") ? 0.6 : 1}
                    >
                      <Text
                        style={[styles.customerPhone, { color: order.customerAddress.startsWith("https://") ? "#4CAF50" : colors.mutedForeground, fontFamily: F.regular }]}
                        numberOfLines={1}
                      >
                        {order.customerAddress.startsWith("https://") ? "📍 فتح الموقع على الخريطة" : order.customerAddress}
                      </Text>
                      <Feather name="map-pin" size={14} color={order.customerAddress.startsWith("https://") ? "#4CAF50" : colors.mutedForeground} />
                    </TouchableOpacity>
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

                {Platform.OS === "web" && (
                  <TouchableOpacity
                    onPress={() => handlePrint(order)}
                    style={[styles.actionBtn, { backgroundColor: "#1A2A3A", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}
                    activeOpacity={0.8}
                  >
                    <Feather name="printer" size={15} color="#64B5F6" />
                    <Text style={[styles.actionBtnText, { fontFamily: F.bold, color: "#64B5F6" }]}>طباعة الإيصال</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Print Receipt Modal */}
      <Modal
        visible={!!printOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setPrintOrder(null)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000AA", padding: 20 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 22, width: "100%", maxWidth: 420, gap: 16, borderWidth: 1, borderColor: colors.border }}>
            {/* Header */}
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 28 }}>🖨️</Text>
              <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 18, textAlign: "center" }}>
                طباعة الإيصال؟
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 13, textAlign: "center" }}>
                تم قبول الطلب — هل تريد طباعة إيصال للزبون؟
              </Text>
            </View>

            {/* Order Summary */}
            {printOrder && (
              <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 15 }}>
                    طلب اليوم #{printOrder.dailyNumber}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>
                    {new Date(printOrder.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 14, textAlign: "right" }}>
                  {printOrder.customerName} — {printOrder.customerPhone}
                </Text>
                {printOrder.items.map((item, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>
                      {(item.price * item.quantity) % 1 === 0 ? (item.price * item.quantity) : (item.price * item.quantity).toFixed(2)} ر.س
                    </Text>
                    <Text style={{ color: colors.foreground, fontFamily: F.semi, fontSize: 12 }}>
                      {item.name} × {item.quantity}
                    </Text>
                  </View>
                ))}
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 14 }}>
                    {(printOrder.totalPrice / 100).toFixed(2)} ر.س
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.bold, fontSize: 14 }}>المجموع</Text>
                </View>
              </View>
            )}

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setPrintOrder(null); }}
                style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.mutedForeground, fontFamily: F.bold, fontSize: 14 }}>تخطي</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (printOrder) handlePrint(printOrder); setPrintOrder(null); }}
                style={{ flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.gold }}
                activeOpacity={0.8}
              >
                <Feather name="printer" size={18} color="#1A0A00" />
                <Text style={{ color: "#1A0A00", fontFamily: F.extra, fontSize: 15 }}>طباعة الإيصال</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Customer Link Modal */}
      <Modal
        visible={showLinkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000088" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_800ExtraBold", fontSize: 20, textAlign: "center" }}>
              🔗 رابط موقع العميل
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "center" }}>
              شارك هذا الرابط مع عملائك ليطلبوا مباشرة من الموقع
            </Text>

            {/* URL Box */}
            <TouchableOpacity
              onPress={handleCopyLink}
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#4CAF50", fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "center" }} numberOfLines={2}>
                {customerUrl}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={handleCopyLink}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: copied ? "#1A4A1A" : "#1A3A2A", borderRadius: 14, paddingVertical: 14 }}
              >
                <Feather name={copied ? "check" : "copy"} size={17} color={copied ? "#81C784" : "#4CAF50"} />
                <Text style={{ color: copied ? "#81C784" : "#4CAF50", fontFamily: "Cairo_700Bold", fontSize: 14 }}>
                  {copied ? "تم النسخ ✓" : "نسخ الرابط"}
                </Text>
              </TouchableOpacity>
              {Platform.OS !== "web" && (
                <TouchableOpacity
                  onPress={handleShareLink}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#1A2A3A", borderRadius: 14, paddingVertical: 14 }}
                >
                  <Feather name="share-2" size={17} color="#64B5F6" />
                  <Text style={{ color: "#64B5F6", fontFamily: "Cairo_700Bold", fontSize: 14 }}>مشاركة</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setShowLinkModal(false)}
              style={{ alignItems: "center", paddingVertical: 12 }}
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_600SemiBold", fontSize: 14 }}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Stock Modal */}
      <Modal
        visible={showStockModal}
        animationType="slide"
        onRequestClose={() => setShowStockModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowStockModal(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 18 }}>📦 إدارة المخزون</Text>
            <TouchableOpacity onPress={fetchMenuItems} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
              <Feather name="refresh-cw" size={16} color={colors.gold} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
            {CATEGORIES.map((cat) => {
              const catItems = menuItems.filter((i) => i.category === cat.id);
              if (catItems.length === 0) return null;
              return (
                <View key={cat.id}>
                  <View style={{ backgroundColor: "#1A1008", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#2A1A0A" }}>
                    <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                    <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 15 }}>{cat.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, marginRight: "auto" }}>{catItems.length} صنف</Text>
                  </View>
                  {catItems.map((item) => {
                    const editVal = getStockEditValue(item);
                    const isSaving = stockSaving === item.itemId;
                    const isUnlimited = editVal === "";
                    const isDirty = item.itemId in stockEdits;
                    return (
                      <View key={item.itemId} style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ color: item.available ? colors.foreground : colors.mutedForeground, fontFamily: F.bold, fontSize: 14 }} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            {item.stock === null ? (
                              <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>∞ غير محدود</Text>
                            ) : item.stock === 0 ? (
                              <Text style={{ color: "#E57373", fontFamily: F.bold, fontSize: 11 }}>⚠️ نافد</Text>
                            ) : (
                              <Text style={{ color: item.stock <= 3 ? colors.gold : "#64B5F6", fontFamily: F.semi, fontSize: 11 }}>
                                {item.stock} متبقي{item.stock <= 3 ? " ⚠️" : ""}
                              </Text>
                            )}
                            {!item.available && <Text style={{ color: "#E57373", fontFamily: F.regular, fontSize: 10 }}>• معطل</Text>}
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => {
                              if (isUnlimited) {
                                setStockEdits((prev) => ({ ...prev, [item.itemId]: "10" }));
                              } else {
                                setStockEdits((prev) => ({ ...prev, [item.itemId]: "" }));
                              }
                            }}
                            style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: isUnlimited ? "#1A4A1A" : colors.secondary, borderWidth: 1, borderColor: isUnlimited ? "#4CAF50" : colors.border }}
                          >
                            <Text style={{ color: isUnlimited ? "#4CAF50" : colors.mutedForeground, fontFamily: F.bold, fontSize: 12 }}>∞</Text>
                          </TouchableOpacity>

                          {!isUnlimited && (
                            <>
                              <TouchableOpacity
                                onPress={() => adjustStock(item, -1)}
                                style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
                              >
                                <Feather name="minus" size={14} color={colors.foreground} />
                              </TouchableOpacity>
                              <TextInput
                                value={editVal}
                                onChangeText={(t) => setStockEdits((prev) => ({ ...prev, [item.itemId]: t.replace(/[^0-9]/g, "") }))}
                                keyboardType="number-pad"
                                style={{ width: 44, height: 32, borderRadius: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: isDirty ? colors.gold : colors.border, color: colors.foreground, fontFamily: F.bold, fontSize: 15, textAlign: "center" }}
                              />
                              <TouchableOpacity
                                onPress={() => adjustStock(item, 1)}
                                style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
                              >
                                <Feather name="plus" size={14} color={colors.foreground} />
                              </TouchableOpacity>
                            </>
                          )}

                          {(isDirty || isUnlimited !== (item.stock === null)) && (
                            isSaving ? (
                              <ActivityIndicator size="small" color={colors.gold} />
                            ) : (
                              <TouchableOpacity
                                onPress={() => handleQuickStock(item.itemId, editVal)}
                                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.gold }}
                              >
                                <Text style={{ color: "#1A0A00", fontFamily: F.bold, fontSize: 12 }}>حفظ</Text>
                              </TouchableOpacity>
                            )
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
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
  orderMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1 },
  orderId: { fontSize: 18 },
  orderTime: { fontSize: 12 },
  orderDate: { fontSize: 11 },
  dailyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  dailyNumber: { fontSize: 14 },
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
