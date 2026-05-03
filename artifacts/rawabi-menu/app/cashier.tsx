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
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { loadPins, isMasterCode } from "@/hooks/usePins";
import { useNotifications } from "@/hooks/useNotifications";
import { apiGet, apiPatch, apiPut, apiPost, apiDelete } from "@/constants/api";
import { useChatUnreadAlert } from "@/hooks/useChatSound";
import { type ApiMenuItem } from "@/hooks/useMenu";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const CASHIER_PIN_DEFAULT = "Aa@000";

const CATEGORIES = [
  { id: "chicken",  name: "الدجاج",             icon: "🍗" },
  { id: "meat",     name: "اللحوم",             icon: "🥩" },
  { id: "mains",    name: "الأطباق الرئيسية",   icon: "🍽️" },
  { id: "sides",    name: "الإيدامات",          icon: "🥘" },
  { id: "salads",   name: "السلطات",            icon: "🥗" },
  { id: "desserts", name: "الحلويات",           icon: "🍮" },
  { id: "drinks",   name: "المشروبات",          icon: "🥤" },
  { id: "extras",   name: "إضافات",             icon: "✨" },
];

type OrderStatus = "pending" | "preparing" | "ready" | "done" | "cancelled";

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
  cancelled: "ملغى",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "#E53935",
  preparing: "#FB8C00",
  ready: "#43A047",
  done: "#757575",
  cancelled: "#9E9E9E",
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

  // ─── Chat types ────────────────────────────────────────
  interface ChatMsg { id: number; orderId: number; text: string; fromCashier: boolean; createdAt: string; readAt: string | null; }
  type CashierOrder = (typeof orders)[0];

  // ─── Chat state ────────────────────────────────────────
  const [chatOrder, setChatOrder]           = useState<CashierOrder | null>(null);
  const [chatMessages, setChatMessages]     = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]           = useState("");
  const [chatSending, setChatSending]       = useState(false);
  const [chatLoading, setChatLoading]       = useState(false);
  const [unreadByOrder, setUnreadByOrder]   = useState<Record<number, number>>({});
  const chatScrollRef                        = useRef<ScrollView>(null);
  const chatPollRef                          = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Cashier view ──────────────────────────────────────
  const [cashierView, setCashierView] = useState<"orders" | "drivers">("orders");

  // ─── Drivers state ─────────────────────────────────────
  interface Driver { id: number; name: string; phone: string; photoUrl: string | null; active: boolean; }
  const [driversEnabled, setDriversEnabled] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assigningOrderId, setAssigningOrderId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Record<number, { driverId: number; driverName: string; status: string }>>({});

  // ─── Driver financial summaries ─────────────────────────
  interface DrvOrder { orderId: number; dailyNumber: number | null; customerName: string; totalPrice: number; deliveredAt: string | null; }
  interface DrvSummary { driver: Driver; ordersCount: number; totalCollected: number; orders: DrvOrder[]; }
  const [drvSummaries, setDrvSummaries] = useState<DrvSummary[]>([]);
  const [drvSummLoading, setDrvSummLoading] = useState(false);
  const [drvExpanded, setDrvExpanded] = useState<number | null>(null);
  const [drvDetailRow, setDrvDetailRow] = useState<DrvSummary | null>(null);

  // ─── Active driver assignments (picked_up — in transit) ─
  interface ActiveAssignment {
    orderId: number; driverId: number; pickedUpAt: string | null;
    driverName: string; driverPhone: string;
    dailyNumber: number | null; customerName: string;
    customerAddress: string | null; totalPrice: number; paymentMethod: string;
  }
  const [activeAssignments, setActiveAssignments] = useState<ActiveAssignment[]>([]);
  const [activeAssignmentsLoading, setActiveAssignmentsLoading] = useState(false);
  const [deliveringOrderId, setDeliveringOrderId] = useState<number | null>(null);

  const loadDrvSummaries = useCallback(async () => {
    setDrvSummLoading(true);
    try {
      const data = await apiGet<DrvSummary[]>("/drivers/daily-summaries");
      setDrvSummaries(data);
    } catch {}
    setDrvSummLoading(false);
  }, []);

  const loadActiveAssignments = useCallback(async () => {
    setActiveAssignmentsLoading(true);
    try {
      const data = await apiGet<ActiveAssignment[]>("/drivers/active-assignments");
      setActiveAssignments(data);
    } catch {}
    setActiveAssignmentsLoading(false);
  }, []);

  const confirmDeliveryByCashier = useCallback(async (orderId: number) => {
    setDeliveringOrderId(orderId);
    try {
      await apiPut(`/orders/${orderId}/driver-status`, { status: "delivered" });
      setActiveAssignments(prev => prev.filter(a => a.orderId !== orderId));
      loadDrvSummaries();
    } catch { Alert.alert("خطأ", "تعذّر تأكيد التسليم"); }
    setDeliveringOrderId(null);
  }, [loadDrvSummaries]);

  const loadDrivers = useCallback(async () => {
    try {
      const [dr, en] = await Promise.all([
        apiGet<Driver[]>("/drivers"),
        apiGet<{ enabled: boolean }>("/settings/drivers-enabled"),
      ]);
      setDrivers(dr.filter((d) => d.active));
      setDriversEnabled(en.enabled);
    } catch {}
  }, []);

  const loadAssignment = useCallback(async (orderId: number) => {
    try {
      const row = await apiGet<{ assignment: { driverId: number; status: string }; driver: { name: string } } | null>(`/orders/${orderId}/assignment`);
      if (row) {
        setAssignments((prev) => ({ ...prev, [orderId]: { driverId: row.assignment.driverId, driverName: row.driver?.name ?? "مندوب", status: row.assignment.status } }));
      }
    } catch {}
  }, []);

  const assignDriver = useCallback(async (orderId: number, driverId: number) => {
    try {
      await apiPost(`/orders/${orderId}/assign-driver`, { driverId });
      await loadAssignment(orderId);
      setAssigningOrderId(null);
    } catch { Alert.alert("خطأ", "تعذّر تعيين المندوب"); }
  }, [loadAssignment]);

  const unassignDriver = useCallback(async (orderId: number) => {
    try {
      await apiDelete(`/orders/${orderId}/assign-driver`);
      setAssignments((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
    } catch {}
  }, []);

  useEffect(() => { if (authenticated) loadDrivers(); }, [authenticated, loadDrivers]);

  // ─── Broadcast notification state ──────────────────────
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle]         = useState("");
  const [broadcastBody, setBroadcastBody]           = useState("");
  const [broadcastSending, setBroadcastSending]     = useState(false);
  const [broadcastRemaining, setBroadcastRemaining] = useState<number | null>(null);

  const fetchBroadcastQuota = useCallback(async () => {
    try {
      const data = await apiGet<{ sent: number; remaining: number; limit: number }>("/notifications/broadcast");
      setBroadcastRemaining(data.remaining);
    } catch {}
  }, []);

  useEffect(() => { if (showBroadcastModal) fetchBroadcastQuota(); }, [showBroadcastModal, fetchBroadcastQuota]);

  const sendBroadcast = useCallback(async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    setBroadcastSending(true);
    try {
      const res = await apiPost<{ ok: boolean; remaining: number }>("/notifications/broadcast", {
        title: broadcastTitle.trim(),
        body:  broadcastBody.trim(),
      });
      setBroadcastRemaining(res.remaining);
      setBroadcastTitle("");
      setBroadcastBody("");
      Alert.alert("تم الإرسال ✓", `تم إرسال الإشعار لجميع المستخدمين\nالمتبقي هذا الأسبوع: ${res.remaining}`);
      setShowBroadcastModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذّر الإرسال";
      Alert.alert("خطأ", msg);
    } finally {
      setBroadcastSending(false);
    }
  }, [broadcastTitle, broadcastBody]);

  // ─── Stock state ───────────────────────────────────────
  const [showStockModal, setShowStockModal] = useState(false);
  const [menuItems, setMenuItems] = useState<ApiMenuItem[]>([]);
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [stockSaving, setStockSaving] = useState<string | null>(null);
  const [stockViewMode, setStockViewMode] = useState<"table" | "edit">("table");

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
      // Play the custom M4A sound file
      const audio = new (window as any).Audio();
      audio.src = "/assets/sounds/order_arrived.m4a";
      audio.volume = 1.0;
      audio.play().catch(() => {
        // Fallback: synthesised chime if file fails
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        [880, 1108, 1320].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = "sine"; osc.frequency.value = freq;
          const start = ctx.currentTime + i * 0.18;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
          osc.start(start); osc.stop(start + 0.3);
        });
      });
    } catch { /* silent */ }
  }, []);

  const customerUrl = Platform.OS === "web"
    ? (typeof window !== "undefined" ? window.location.origin + "/" : "")
    : (process.env.EXPO_PUBLIC_API_BASE_URL || "https://dc93e0aa-3f78-420b-b841-3af65fe535e6-00-3qwzp8t1i4uai.pike.replit.dev") + "/";

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

      // Load assignments for all delivery orders (have an address)
      const deliveryOrders = data.filter(
        (o) => !!o.customerAddress || o.notes?.includes("توصيل")
      );
      if (deliveryOrders.length > 0) {
        Promise.allSettled(
          deliveryOrders.map((o) =>
            apiGet<{ assignment: { driverId: number; status: string }; driver: { name: string } } | null>(
              `/orders/${o.id}/assignment`
            ).then((row) => {
              if (row) {
                setAssignments((prev) => ({
                  ...prev,
                  [o.id]: { driverId: row.assignment.driverId, driverName: row.driver?.name ?? "مندوب", status: row.assignment.status },
                }));
              }
            })
          )
        );
      }
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
      // Auto-advance driver to picked_up when cashier marks order done
      if (newStatus === "done" && assignments[order.id]?.status === "assigned") {
        try {
          await apiPut(`/orders/${order.id}/driver-status`, { status: "picked_up" });
          setAssignments(prev => ({ ...prev, [order.id]: { ...prev[order.id], status: "picked_up" } }));
        } catch {}
      }
    } catch {
      Alert.alert("خطأ", "تعذر تحديث الحالة");
    }
  };

  const handleCancelOrder = (order: Order) => {
    const doCancel = async () => {
      try {
        const updated = await apiPatch<Order>(`/orders/${order.id}/status`, { status: "cancelled" });
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      } catch {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert("تعذر إلغاء الطلب");
        } else {
          Alert.alert("خطأ", "تعذر إلغاء الطلب");
        }
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmed = window.confirm(
        `إلغاء طلب #${order.dailyNumber} — ${order.customerName}؟`
      );
      if (confirmed) doCancel();
    } else {
      Alert.alert(
        "إلغاء الطلب",
        `هل تريد إلغاء طلب #${order.dailyNumber} — ${order.customerName}؟`,
        [
          { text: "لا", style: "cancel" },
          { text: "نعم، إلغاء", style: "destructive", onPress: doCancel },
        ]
      );
    }
  };

  // ─── Chat functions ────────────────────────────────────
  const fetchUnreadCounts = useCallback(async () => {
    try {
      type Convo = { orderId: number; unread: number };
      const convos = await apiGet<Convo[]>("/messages/conversations");
      const counts: Record<number, number> = {};
      for (const c of convos) { if (c.unread > 0) counts[c.orderId] = c.unread; }
      setUnreadByOrder(counts);
    } catch {}
  }, []);

  const openOrderChat = useCallback(async (order: CashierOrder) => {
    setChatOrder(order);
    setChatLoading(true);
    setChatMessages([]);
    try {
      const msgs = await apiGet<ChatMsg[]>(`/messages/order/${order.id}`);
      setChatMessages(msgs);
      await apiPatch(`/messages/order/${order.id}/read`, { fromCashier: true });
      setUnreadByOrder(prev => { const n = { ...prev }; delete n[order.id]; return n; });
    } catch {} finally { setChatLoading(false); }
  }, []);

  const sendChatMessage = useCallback(async () => {
    if (!chatOrder || !chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatSending(true);
    try {
      const msg = await apiPost<ChatMsg>(`/messages/order/${chatOrder.id}`, { text, fromCashier: true });
      setChatMessages(prev => [...prev, msg]);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {} finally { setChatSending(false); }
  }, [chatOrder, chatInput]);

  // Poll messages while chat is open
  useEffect(() => {
    if (!chatOrder) {
      if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; }
      return;
    }
    chatPollRef.current = setInterval(async () => {
      try {
        const msgs = await apiGet<ChatMsg[]>(`/messages/order/${chatOrder.id}`);
        setChatMessages(msgs);
        await apiPatch(`/messages/order/${chatOrder.id}/read`, { fromCashier: true });
      } catch {}
    }, 5000);
    return () => { if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; } };
  }, [chatOrder]);

  // Poll unread counts periodically
  useEffect(() => {
    fetchUnreadCounts();
    const t = setInterval(fetchUnreadCounts, 15000);
    return () => clearInterval(t);
  }, [fetchUnreadCounts]);

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const totalUnread  = Object.values(unreadByOrder).reduce((s, n) => s + n, 0);

  useChatUnreadAlert(totalUnread);
  useChatUnreadAlert(pendingCount);

  if (!pinsLoaded) return null;
  if (!authenticated) {
    return <PinScreen onSuccess={() => setAuthenticated(true)} correctPin={cashierPin} />;
  }

  const filtered = filter === "all"
    ? orders.filter((o) => o.status !== "done" && o.status !== "cancelled")
    : orders.filter((o) => o.status === filter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { backgroundColor: "#1A1008", paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        {/* ── Row 1: back · title · refresh ── */}
        <View style={styles.headerRow1}>
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
          <TouchableOpacity onPress={() => fetchOrders()} style={[styles.refreshBtn, { backgroundColor: colors.secondary }]}>
            <Feather name="refresh-cw" size={18} color={colors.gold} />
          </TouchableOpacity>
        </View>

        {/* ── Row 2: action buttons ── */}
        <View style={styles.headerRow2}>
          <TouchableOpacity
            onPress={() => { const first = orders.find(o => unreadByOrder[o.id]); if (first) openOrderChat(first); }}
            style={[styles.headerActionBtn, { backgroundColor: "#0D2030", borderWidth: 1, borderColor: totalUnread > 0 ? "#3A8ABF" : "#1E4A6A" }]}
          >
            <View style={{ position: "relative" }}>
              <Feather name="message-circle" size={14} color={totalUnread > 0 ? "#64B5F6" : "#3A6A8A"} />
              {totalUnread > 0 && (
                <View style={{ position: "absolute", top: -5, right: -5, backgroundColor: "#E53935", borderRadius: 8, minWidth: 14, height: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 }}>
                  <Text style={{ color: "#fff", fontSize: 8, fontFamily: "Cairo_700Bold" }}>{totalUnread > 9 ? "9+" : totalUnread}</Text>
                </View>
              )}
            </View>
            <Text style={{ color: totalUnread > 0 ? "#64B5F6" : "#3A6A8A", fontFamily: "Cairo_700Bold", fontSize: 12 }}>الرسائل</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowBroadcastModal(true)}
            style={[styles.headerActionBtn, { backgroundColor: "#1A2A1A", borderWidth: 1, borderColor: "#2A5A2A" }]}
          >
            <Feather name="bell" size={14} color="#81C784" />
            <Text style={{ color: "#81C784", fontFamily: "Cairo_700Bold", fontSize: 12 }}>
              إشعار{broadcastRemaining !== null ? ` (${broadcastRemaining})` : ""}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowStockModal(true)}
            style={[styles.headerActionBtn, { backgroundColor: "#1A2A3A", borderWidth: 1, borderColor: "#1E3A5A" }]}
          >
            <Feather name="package" size={14} color="#64B5F6" />
            <Text style={{ color: "#64B5F6", fontFamily: "Cairo_700Bold", fontSize: 12 }}>المخزون</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/admin-menu")}
            style={[styles.headerActionBtn, { backgroundColor: colors.gold }]}
          >
            <Feather name="settings" size={14} color="#1A0A00" />
            <Text style={{ color: "#1A0A00", fontFamily: "Cairo_700Bold", fontSize: 12 }}>القائمة</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Bottom Nav Bar ── */}
      <View style={{ flexDirection: "row-reverse", backgroundColor: "#1A1008", borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {([
          { key: "orders",  label: "استقبال الطلبات", icon: "clipboard" as const, color: "#E8920C", badge: pendingCount },
          { key: "drivers", label: "المناديب",         icon: "truck"     as const, color: "#4CAF50", badge: 0 },
        ]).map(tab => {
          const active = cashierView === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setCashierView(tab.key as "orders" | "drivers");
                if (tab.key === "drivers") { loadDrvSummaries(); loadActiveAssignments(); }
              }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: active ? tab.color : "transparent", gap: 3 }}
            >
              <View style={{ position: "relative" }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: active ? tab.color + "22" : "transparent", alignItems: "center", justifyContent: "center" }}>
                  <Feather name={tab.icon} size={22} color={active ? tab.color : colors.mutedForeground} />
                </View>
                {tab.badge > 0 && (
                  <View style={{ position: "absolute", top: 0, left: 0, backgroundColor: "#E53935", borderRadius: 9, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontFamily: F.extra }}>{tab.badge > 9 ? "9+" : tab.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: active ? tab.color : colors.mutedForeground, fontFamily: active ? F.bold : F.regular, fontSize: 12 }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* New Order Alert Banner */}
      {cashierView === "orders" && hasNewOrder && (
        <View style={{ backgroundColor: "#E53935", paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
          <Text style={{ color: "#fff", fontFamily: "Cairo_800ExtraBold", fontSize: 16, letterSpacing: 0.5 }}>
            طلب جديد وصل!
          </Text>
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </View>
      )}

      {/* ── Drivers view ── */}
      {cashierView === "drivers" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* ── Active (in-transit) orders section ── */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#4CAF50" }} />
                <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 15 }}>🚗 بانتظار التسليم</Text>
                {activeAssignments.length > 0 && (
                  <View style={{ backgroundColor: "#4CAF50", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                    <Text style={{ color: "#fff", fontFamily: F.extra, fontSize: 11 }}>{activeAssignments.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={loadActiveAssignments} style={{ padding: 6 }}>
                <Feather name="refresh-cw" size={14} color="#4CAF50" />
              </TouchableOpacity>
            </View>

            {activeAssignmentsLoading && <ActivityIndicator color="#4CAF50" style={{ marginVertical: 10 }} />}

            {!activeAssignmentsLoading && activeAssignments.length === 0 && (
              <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 18, alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 32 }}>✅</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13 }}>لا يوجد طلبات في الطريق حالياً</Text>
              </View>
            )}

            {!activeAssignmentsLoading && activeAssignments.map(a => (
              <View key={a.orderId} style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: "#4CAF5044", overflow: "hidden" }}>
                {/* Order info */}
                <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 14, gap: 10 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 7 }}>
                      <View style={{ backgroundColor: "#E8920C22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ color: "#E8920C", fontFamily: F.extra, fontSize: 13 }}>#{a.dailyNumber ?? a.orderId}</Text>
                      </View>
                      <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 14 }}>{a.customerName}</Text>
                    </View>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 13 }}>🛵</Text>
                      <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 13 }}>{a.driverName}</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>• في الطريق</Text>
                    </View>
                    {a.customerAddress && (
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }} numberOfLines={1}>
                        📍 {a.customerAddress.startsWith("https://") ? "موقع GPS" : a.customerAddress}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 18 }}>{a.totalPrice.toFixed(2)}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 11 }}>
                      {a.paymentMethod === "cash" ? "💵 نقدي" : "💳 إلكتروني"}
                    </Text>
                  </View>
                </View>
                {/* Confirm delivery button */}
                <TouchableOpacity
                  onPress={() => confirmDeliveryByCashier(a.orderId)}
                  disabled={deliveringOrderId === a.orderId}
                  style={{ backgroundColor: "#1A3A1A", borderTopWidth: 1, borderTopColor: "#4CAF5033", paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                  activeOpacity={0.75}
                >
                  {deliveringOrderId === a.orderId
                    ? <ActivityIndicator size="small" color="#4CAF50" />
                    : <>
                        <Feather name="check-circle" size={16} color="#4CAF50" />
                        <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 14 }}>✅ تم التسليم للعميل</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

          {/* Header row */}
          <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 16 }}>🛵 تقرير المناديب</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>
                {new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={loadDrvSummaries}
              style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: "#4CAF5044", backgroundColor: "#0A2010" }}
            >
              <Feather name="refresh-cw" size={14} color="#4CAF50" />
              <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 13 }}>تحديث</Text>
            </TouchableOpacity>
          </View>

          {drvSummLoading && <ActivityIndicator color="#4CAF50" style={{ marginTop: 30 }} />}

          {!drvSummLoading && drvSummaries.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 60, gap: 10 }}>
              <Text style={{ fontSize: 44 }}>🛵</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 14 }}>لا يوجد مناديب مفعّلون</Text>
            </View>
          )}

          {/* Grand totals row */}
          {!drvSummLoading && drvSummaries.length > 0 && (() => {
            const totalOrders  = drvSummaries.reduce((s, r) => s + r.ordersCount, 0);
            const totalMoney   = drvSummaries.reduce((s, r) => s + r.totalCollected, 0);
            return (
              <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: "#E8920C44", padding: 16, alignItems: "center", gap: 6 }}>
                  <Feather name="package" size={20} color="#E8920C" />
                  <Text style={{ color: "#E8920C", fontFamily: F.extra, fontSize: 30 }}>{totalOrders}</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 12, textAlign: "center" }}>إجمالي الطلبات</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: "#4CAF5044", padding: 16, alignItems: "center", gap: 6 }}>
                  <Feather name="dollar-sign" size={20} color="#4CAF50" />
                  <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 24 }}>{totalMoney.toFixed(2)}</Text>
                  <Text style={{ color: "#4CAF50", fontFamily: F.bold, fontSize: 11 }}>ريال سعودي</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 12, textAlign: "center" }}>إجمالي المحصّل</Text>
                </View>
              </View>
            );
          })()}

          {/* Per-driver cards — tap to open detail modal */}
          {!drvSummLoading && drvSummaries.map(row => {
            const inTransit = activeAssignments.filter(a => a.driverId === row.driver.id).length;
            const totalToday = row.ordersCount + inTransit;
            return (
              <TouchableOpacity
                key={row.driver.id}
                onPress={() => setDrvDetailRow(row)}
                activeOpacity={0.75}
                style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: totalToday > 0 ? "#4CAF5033" : colors.border, overflow: "hidden" }}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", padding: 14, gap: 12 }}>
                  {/* Avatar */}
                  {row.driver.photoUrl
                    ? <Image source={{ uri: row.driver.photoUrl }} style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: row.driver.active ? "#4CAF50" : colors.border }} />
                    : <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#0A2010", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: row.driver.active ? "#4CAF50" : colors.border }}>
                        <Text style={{ fontSize: 26 }}>🛵</Text>
                      </View>
                  }

                  {/* Name + status */}
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 7 }}>
                      <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 15 }}>{row.driver.name}</Text>
                      <View style={{ backgroundColor: row.driver.active ? "#4CAF5022" : "#75757522", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 }}>
                        <Text style={{ color: row.driver.active ? "#4CAF50" : colors.mutedForeground, fontFamily: F.semi, fontSize: 10 }}>
                          {row.driver.active ? "نشط" : "موقوف"}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>📱 {row.driver.phone}</Text>
                    {inTransit > 0 && (
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#4CAF50" }} />
                        <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>{inTransit} في الطريق</Text>
                      </View>
                    )}
                  </View>

                  {/* Stats */}
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: "#E8920C18", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                      <Text style={{ color: "#E8920C", fontFamily: F.extra, fontSize: 18 }}>{totalToday}</Text>
                      <Text style={{ color: "#E8920C", fontFamily: F.semi, fontSize: 11 }}>طلب</Text>
                    </View>
                    <View style={{ flexDirection: "row-reverse", alignItems: "baseline", gap: 3 }}>
                      <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 16 }}>{row.totalCollected.toFixed(2)}</Text>
                      <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>ر.س</Text>
                    </View>
                  </View>

                  <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Orders view ── */}
      {cashierView === "orders" && (<>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
        style={{ backgroundColor: "#1A1008" }}
      >
        {([["all", "الكل"], ["pending", "جديد"], ["preparing", "جاري التحضير"], ["ready", "جاهز"], ["done", "تم"], ["cancelled", "ملغى"]] as [string, string][]).map(([key, label]) => (
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
            const hasAssignedDriver = order.status === "ready" && assignments[order.id]?.status === "assigned";
            const nextLabel = hasAssignedDriver ? "تم تسليم الطلب للمندوب 🛵" : STATUS_NEXT_LABEL[order.status];
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

                {order.status !== "done" && order.status !== "cancelled" && (
                  <TouchableOpacity
                    onPress={() => handleCancelOrder(order)}
                    style={[styles.actionBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: "#9E9E9E", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
                    activeOpacity={0.8}
                  >
                    <Feather name="x" size={14} color="#9E9E9E" />
                    <Text style={[styles.actionBtnText, { fontFamily: F.bold, color: "#9E9E9E" }]}>إلغاء الطلب</Text>
                  </TouchableOpacity>
                )}

                {/* Assign driver button — delivery = has address OR notes contain توصيل */}
                {driversEnabled && (!!order.customerAddress || order.notes?.includes("توصيل")) && (
                  <View style={{ gap: 6 }}>
                    {assignments[order.id] ? (
                      <View style={{ backgroundColor: "#0A1F0A", borderRadius: 10, padding: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#2E7D3244" }}>
                        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                          <Text style={{ fontSize: 16 }}>🛵</Text>
                          <View>
                            <Text style={{ color: "#4CAF50", fontFamily: F.bold, fontSize: 13 }}>{assignments[order.id].driverName}</Text>
                            <Text style={{ color: "#4CAF50AA", fontFamily: F.regular, fontSize: 11 }}>
                              {assignments[order.id].status === "assigned" ? "بانتظار الاستلام" : assignments[order.id].status === "picked_up" ? "🚗 في الطريق" : "✅ تم التسليم"}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => unassignDriver(order.id)} style={{ padding: 6 }}>
                          <Feather name="x" size={14} color="#9E9E9E" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setAssigningOrderId(order.id)}
                        style={[styles.actionBtn, { backgroundColor: "#0A1A0A", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#2E7D32" }]}
                      >
                        <Text style={{ fontSize: 16 }}>🛵</Text>
                        <Text style={[styles.actionBtnText, { fontFamily: F.bold, color: "#4CAF50" }]}>تعيين مندوب</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Assign driver modal */}
                {assigningOrderId === order.id && (
                  <View style={{ backgroundColor: "#0F1A0F", borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: "#2E7D32" }}>
                    <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: "#4CAF50", fontFamily: F.bold, fontSize: 13 }}>اختر مندوباً للطلب</Text>
                      <TouchableOpacity onPress={() => setAssigningOrderId(null)}><Feather name="x" size={16} color="#9E9E9E" /></TouchableOpacity>
                    </View>
                    {drivers.length === 0
                      ? <Text style={{ color: "#9E9E9E", fontFamily: F.regular, fontSize: 12, textAlign: "center" }}>لا يوجد مناديب نشطون</Text>
                      : drivers.map((d) => (
                        <TouchableOpacity
                          key={d.id}
                          onPress={() => assignDriver(order.id, d.id)}
                          style={{ backgroundColor: "#1A2A1A", borderRadius: 10, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10 }}
                        >
                          {d.photoUrl
                            ? <Image source={{ uri: d.photoUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                            : <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#2A3A2A", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 18 }}>🛵</Text></View>
                          }
                          <View>
                            <Text style={{ color: "#fff", fontFamily: F.bold, fontSize: 13 }}>{d.name}</Text>
                            <Text style={{ color: "#9E9E9E", fontFamily: F.regular, fontSize: 11 }}>{d.phone}</Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    }
                  </View>
                )}

                {/* Chat button */}
                <TouchableOpacity
                  onPress={() => openOrderChat(order)}
                  style={[styles.actionBtn, { backgroundColor: "#0D2030", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#1E4A6A" }]}
                  activeOpacity={0.8}
                >
                  <View style={{ position: "relative" }}>
                    <Feather name="message-circle" size={16} color="#64B5F6" />
                    {!!unreadByOrder[order.id] && (
                      <View style={{ position: "absolute", top: -5, right: -5, backgroundColor: "#E53935", borderRadius: 8, minWidth: 14, height: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 }}>
                        <Text style={{ color: "#fff", fontSize: 8, fontFamily: F.bold }}>{unreadByOrder[order.id]}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.actionBtnText, { fontFamily: F.bold, color: "#64B5F6" }]}>
                    مراسلة العميل{unreadByOrder[order.id] ? `  •  ${unreadByOrder[order.id]} جديدة` : ""}
                  </Text>
                </TouchableOpacity>

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
      </>)}

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

      {/* ── Driver Detail Modal ── */}
      <Modal
        visible={!!drvDetailRow}
        transparent
        animationType="slide"
        onRequestClose={() => setDrvDetailRow(null)}
      >
        <View style={{ flex: 1, backgroundColor: "#000000BB", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 16, maxHeight: "88%" }}>
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 10, marginBottom: 14 }} />

            {drvDetailRow && (() => {
              const d = drvDetailRow.driver;
              const inTransit = activeAssignments.filter(a => a.driverId === d.id);
              const totalOrders = drvDetailRow.ordersCount + inTransit.length;
              return (
                <>
                  {/* Driver header */}
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    {d.photoUrl
                      ? <Image source={{ uri: d.photoUrl }} style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: "#4CAF50" }} />
                      : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#0A2010", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#4CAF50" }}>
                          <Text style={{ fontSize: 28 }}>🛵</Text>
                        </View>
                    }
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 18 }}>{d.name}</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 13 }}>📱 {d.phone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setDrvDetailRow(null)} style={{ padding: 8 }}>
                      <Feather name="x" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>

                  {/* Stats row */}
                  <View style={{ flexDirection: "row-reverse", gap: 10, padding: 16 }}>
                    <View style={{ flex: 1, backgroundColor: "#1A1A0A", borderRadius: 16, borderWidth: 1, borderColor: "#E8920C44", padding: 14, alignItems: "center", gap: 4 }}>
                      <Text style={{ fontSize: 24 }}>📦</Text>
                      <Text style={{ color: "#E8920C", fontFamily: F.extra, fontSize: 30 }}>{totalOrders}</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 12, textAlign: "center" }}>طلبات اليوم</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: "#0A1A0A", borderRadius: 16, borderWidth: 1, borderColor: "#4CAF5044", padding: 14, alignItems: "center", gap: 4 }}>
                      <Text style={{ fontSize: 24 }}>💵</Text>
                      <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 26 }}>{drvDetailRow.totalCollected.toFixed(2)}</Text>
                      <Text style={{ color: "#4CAF50", fontFamily: F.bold, fontSize: 11 }}>ريال سعودي</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 12, textAlign: "center" }}>المحصّل اليوم</Text>
                    </View>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 16 }}>
                    {/* In-transit orders */}
                    {inTransit.length > 0 && (
                      <>
                        <Text style={{ color: "#4CAF50", fontFamily: F.bold, fontSize: 13, textAlign: "right", marginBottom: 4 }}>🚗 في الطريق</Text>
                        {inTransit.map(a => (
                          <View key={a.orderId} style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0A2A0A", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#4CAF5033" }}>
                            <View style={{ gap: 2 }}>
                              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                                <View style={{ backgroundColor: "#E8920C22", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 }}>
                                  <Text style={{ color: "#E8920C", fontFamily: F.extra, fontSize: 11 }}>#{a.dailyNumber ?? a.orderId}</Text>
                                </View>
                                <Text style={{ color: colors.foreground, fontFamily: F.semi, fontSize: 13 }}>{a.customerName}</Text>
                              </View>
                              <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>في الطريق 🚗</Text>
                            </View>
                            <View style={{ alignItems: "flex-end", gap: 2 }}>
                              <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 15 }}>{a.totalPrice.toFixed(2)}</Text>
                              <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 10 }}>
                                {a.paymentMethod === "cash" ? "💵 نقدي" : "💳 إلكتروني"}
                              </Text>
                            </View>
                          </View>
                        ))}
                        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
                      </>
                    )}

                    {/* Delivered orders */}
                    {drvDetailRow.orders.length === 0 && inTransit.length === 0 ? (
                      <View style={{ alignItems: "center", paddingVertical: 30, gap: 8 }}>
                        <Text style={{ fontSize: 36 }}>📋</Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13 }}>لا يوجد طلبات مسلّمة اليوم</Text>
                      </View>
                    ) : drvDetailRow.orders.length > 0 ? (
                      <>
                        <Text style={{ color: colors.mutedForeground, fontFamily: F.bold, fontSize: 13, textAlign: "right", marginBottom: 4 }}>✅ تم التسليم</Text>
                        {drvDetailRow.orders.map(ord => {
                          const time = ord.deliveredAt
                            ? new Date(ord.deliveredAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
                            : "--:--";
                          return (
                            <View key={ord.orderId} style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                              <View style={{ gap: 2 }}>
                                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                                  <View style={{ backgroundColor: "#E8920C22", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 }}>
                                    <Text style={{ color: "#E8920C", fontFamily: F.extra, fontSize: 11 }}>#{ord.dailyNumber ?? ord.orderId}</Text>
                                  </View>
                                  <Text style={{ color: colors.foreground, fontFamily: F.semi, fontSize: 13 }}>{ord.customerName}</Text>
                                </View>
                                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                                  <Feather name="clock" size={10} color={colors.mutedForeground} />
                                  <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>{time}</Text>
                                </View>
                              </View>
                              <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 15 }}>{ord.totalPrice.toFixed(2)} ر.س</Text>
                            </View>
                          );
                        })}
                        {/* Total row */}
                        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0A2A0A", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#4CAF5033" }}>
                          <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 14 }}>💰 إجمالي المحصّل</Text>
                          <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 18 }}>{drvDetailRow.totalCollected.toFixed(2)} ر.س</Text>
                        </View>
                      </>
                    ) : null}
                  </ScrollView>
                </>
              );
            })()}
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

      {/* ── Chat Modal ── */}
      <Modal visible={!!chatOrder} animationType="slide" onRequestClose={() => setChatOrder(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: "#0D1F30" }}>
              <TouchableOpacity onPress={() => setChatOrder(null)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <View style={{ alignItems: "center", gap: 3 }}>
                <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 16 }}>💬 مراسلة العميل</Text>
                {chatOrder && (
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>
                    طلب #{chatOrder.dailyNumber} — {chatOrder.customerName}
                  </Text>
                )}
              </View>
              <View style={{ width: 36 }} />
            </View>

            {/* Messages list */}
            <ScrollView
              ref={chatScrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 14, gap: 10 }}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}
            >
              {chatLoading ? (
                <ActivityIndicator size="large" color={colors.gold} style={{ margin: 40 }} />
              ) : chatMessages.length === 0 ? (
                <View style={{ alignItems: "center", padding: 40, gap: 12 }}>
                  <Text style={{ fontSize: 44 }}>💬</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 14, textAlign: "center" }}>
                    لا توجد رسائل بعد{"\n"}ابدأ المحادثة مع العميل
                  </Text>
                </View>
              ) : chatMessages.map((msg) => {
                const time = new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
                return (
                  <View key={msg.id} style={{ alignItems: msg.fromCashier ? "flex-end" : "flex-start" }}>
                    <View style={{ maxWidth: "80%", backgroundColor: msg.fromCashier ? "#2A1800" : colors.secondary, borderRadius: 18, borderTopRightRadius: msg.fromCashier ? 4 : 18, borderTopLeftRadius: msg.fromCashier ? 18 : 4, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: msg.fromCashier ? colors.gold + "55" : colors.border }}>
                      <Text style={{ color: msg.fromCashier ? colors.gold : colors.foreground, fontFamily: F.semi, fontSize: 14, textAlign: msg.fromCashier ? "right" : "left" }}>{msg.text}</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 10, marginTop: 4, textAlign: msg.fromCashier ? "right" : "left" }}>
                        {time}{msg.fromCashier ? " • أنت" : " • العميل"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Input bar */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>
              <TouchableOpacity
                onPress={sendChatMessage}
                disabled={chatSending || !chatInput.trim()}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: chatInput.trim() ? colors.gold : colors.secondary, alignItems: "center", justifyContent: "center" }}
              >
                {chatSending ? <ActivityIndicator size="small" color="#1A0A00" /> : <Feather name="send" size={18} color={chatInput.trim() ? "#1A0A00" : colors.mutedForeground} />}
              </TouchableOpacity>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="اكتب رسالتك للعميل…"
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, backgroundColor: colors.background, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: colors.foreground, fontFamily: F.regular, fontSize: 14, borderWidth: 1, borderColor: colors.border, textAlign: "right" }}
                onSubmitEditing={sendChatMessage}
                returnKeyType="send"
                multiline
              />
            </View>
          </View>
        </KeyboardAvoidingView>
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

          {/* ── View mode toggle ── */}
          <View style={{ flexDirection: "row", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity
              onPress={() => setStockViewMode("table")}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: stockViewMode === "table" ? "#7B1FA2" : colors.secondary, borderWidth: 1, borderColor: stockViewMode === "table" ? "#CE93D8" : colors.border }}
            >
              <Text style={{ color: stockViewMode === "table" ? "#fff" : colors.mutedForeground, fontFamily: F.bold, fontSize: 13 }}>📋 جدول المخزون</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStockViewMode("edit")}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: stockViewMode === "edit" ? colors.gold : colors.secondary, borderWidth: 1, borderColor: stockViewMode === "edit" ? colors.gold : colors.border }}
            >
              <Text style={{ color: stockViewMode === "edit" ? "#1A0A00" : colors.mutedForeground, fontFamily: F.bold, fontSize: 13 }}>✏️ تعديل الكميات</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
            {/* loading guard */}
            {menuItems.length === 0 && (
              <View style={{ padding: 40, alignItems: "center", gap: 12 }}>
                <ActivityIndicator size="large" color="#7B1FA2" />
                <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 14 }}>جار تحميل بيانات المخزون…</Text>
              </View>
            )}

            {/* ── TABLE VIEW ── */}
            {stockViewMode === "table" && CATEGORIES.map((cat) => {
              const catItems = menuItems.filter((i) => i.category === cat.id);
              if (catItems.length === 0) return null;
              const totalStock = catItems.reduce((s, i) => s + (i.stock ?? 0), 0);
              const outCount   = catItems.filter((i) => i.stock === 0).length;
              const lowCount   = catItems.filter((i) => i.stock !== null && i.stock > 0 && i.stock <= 3).length;
              return (
                <View key={cat.id} style={{ marginBottom: 14 }}>
                  <View style={{ backgroundColor: "#1A1008", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#2A1A0A" }}>
                    <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                    <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 15, flex: 1 }}>{cat.name}</Text>
                    {outCount > 0 && <Text style={{ color: "#E57373", fontFamily: F.bold, fontSize: 11 }}>⚠️ {outCount} نافد</Text>}
                    {lowCount > 0 && <Text style={{ color: colors.gold, fontFamily: F.bold, fontSize: 11, marginStart: 6 }}>⬇️ {lowCount} منخفض</Text>}
                  </View>
                  <View style={{ flexDirection: "row", backgroundColor: "#120A02", borderBottomWidth: 1, borderBottomColor: "#2A1A0A", paddingHorizontal: 14, paddingVertical: 6 }}>
                    <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: F.semi, fontSize: 11 }}>الصنف</Text>
                    <Text style={{ width: 64, color: colors.mutedForeground, fontFamily: F.semi, fontSize: 11, textAlign: "center" }}>الكمية</Text>
                    <Text style={{ width: 72, color: colors.mutedForeground, fontFamily: F.semi, fontSize: 11, textAlign: "center" }}>الحالة</Text>
                  </View>
                  {catItems.map((item, idx) => {
                    const isLast = idx === catItems.length - 1;
                    const rowBg = idx % 2 === 0 ? colors.card : "#130D06";
                    const stockColor = item.stock === null ? "#4CAF50" : item.stock === 0 ? "#E57373" : item.stock <= 3 ? colors.gold : "#64B5F6";
                    const statusLabel = item.stock === null ? "غير محدود" : item.stock === 0 ? "نافد" : item.stock <= 3 ? "منخفض" : "متاح";
                    const statusBg = item.stock === null ? "#1A3A1A" : item.stock === 0 ? "#3A1A1A" : item.stock <= 3 ? "#3A2A00" : "#1A2A3A";
                    return (
                      <View key={item.itemId} style={{ flexDirection: "row", alignItems: "center", backgroundColor: rowBg, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border, paddingHorizontal: 14, paddingVertical: 11 }}>
                        <Text style={{ flex: 1, color: item.available ? colors.foreground : colors.mutedForeground, fontFamily: F.bold, fontSize: 13 }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ width: 64, color: stockColor, fontFamily: F.extra, fontSize: 16, textAlign: "center" }}>{item.stock === null ? "∞" : item.stock}</Text>
                        <View style={{ width: 72, alignItems: "center" }}>
                          <View style={{ backgroundColor: statusBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ color: stockColor, fontFamily: F.bold, fontSize: 11 }}>{statusLabel}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: "row", backgroundColor: "#0E0800", paddingHorizontal: 14, paddingVertical: 7, borderTopWidth: 1, borderTopColor: "#2A1A0A" }}>
                    <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>{catItems.length} صنف</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 11 }}>
                      إجمالي المخزون المحدود: <Text style={{ color: colors.gold, fontFamily: F.bold }}>{totalStock}</Text>
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* ── LIVE EDIT VIEW ── */}
            {stockViewMode === "edit" && CATEGORIES.map((cat) => {
              const catItems = menuItems.filter((i) => i.category === cat.id);
              if (catItems.length === 0) return null;
              return (
                <View key={cat.id} style={{ marginBottom: 14 }}>
                  <View style={{ backgroundColor: "#1A1008", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#2A1A0A" }}>
                    <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                    <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 15 }}>{cat.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, marginRight: "auto" }}>{catItems.length} صنف</Text>
                  </View>
                  {catItems.map((item, idx) => {
                    const editVal = getStockEditValue(item);
                    const isSaving = stockSaving === item.itemId;
                    const isUnlimited = editVal === "";
                    const isDirty = item.itemId in stockEdits;
                    const liveQty = isUnlimited ? null : (parseInt(editVal) || 0);
                    const liveColor = liveQty === null ? "#4CAF50" : liveQty === 0 ? "#E57373" : liveQty <= 3 ? colors.gold : "#64B5F6";
                    const liveBg   = liveQty === null ? "#1A3A1A"  : liveQty === 0 ? "#3A1A1A"  : liveQty <= 3 ? "#3A2A00"  : "#1A2A3A";
                    const liveLabel = liveQty === null ? "غير محدود" : liveQty === 0 ? "نافد" : liveQty <= 3 ? "منخفض" : "متاح";
                    const rowBg = idx % 2 === 0 ? colors.card : "#130D06";
                    return (
                      <View key={item.itemId} style={{ backgroundColor: rowBg, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
                        {/* Row 1: name + live badge + save button */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ flex: 1, color: item.available ? colors.foreground : colors.mutedForeground, fontFamily: F.bold, fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ color: liveColor, fontFamily: F.extra, fontSize: 20, minWidth: 28, textAlign: "center" }}>
                              {liveQty === null ? "∞" : liveQty}
                            </Text>
                            <View style={{ backgroundColor: liveBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: liveColor + "55" }}>
                              <Text style={{ color: liveColor, fontFamily: F.bold, fontSize: 11 }}>{liveLabel}</Text>
                            </View>
                          </View>
                          {(isDirty || isUnlimited !== (item.stock === null)) && (
                            isSaving
                              ? <ActivityIndicator size="small" color={colors.gold} />
                              : (
                                <TouchableOpacity onPress={() => handleQuickStock(item.itemId, editVal)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.gold }}>
                                  <Text style={{ color: "#1A0A00", fontFamily: F.bold, fontSize: 13 }}>حفظ ✓</Text>
                                </TouchableOpacity>
                              )
                          )}
                        </View>
                        {/* Row 2: controls — fixed layout, حفظ no longer competes here */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => { isUnlimited ? setStockEdits((prev) => ({ ...prev, [item.itemId]: "10" })) : setStockEdits((prev) => ({ ...prev, [item.itemId]: "" })); }}
                            style={{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: isUnlimited ? "#1A4A1A" : colors.secondary, borderWidth: 1, borderColor: isUnlimited ? "#4CAF50" : colors.border }}
                          >
                            <Text style={{ color: isUnlimited ? "#4CAF50" : colors.mutedForeground, fontFamily: F.bold, fontSize: 15 }}>∞</Text>
                          </TouchableOpacity>
                          {!isUnlimited ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                              <TouchableOpacity onPress={() => adjustStock(item, -1)} style={{ width: 40, height: 36, borderRadius: 8, backgroundColor: "#3A1A1A", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5737344" }}>
                                <Feather name="minus" size={18} color="#E57373" />
                              </TouchableOpacity>
                              <TextInput
                                value={editVal}
                                onChangeText={(t) => setStockEdits((prev) => ({ ...prev, [item.itemId]: t.replace(/[^0-9]/g, "") }))}
                                keyboardType="number-pad"
                                style={{ flex: 1, height: 36, borderRadius: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: isDirty ? colors.gold : colors.border, color: colors.foreground, fontFamily: F.bold, fontSize: 16, textAlign: "center" }}
                              />
                              <TouchableOpacity onPress={() => adjustStock(item, 1)} style={{ width: 40, height: 36, borderRadius: 8, backgroundColor: "#1A3A1A", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#4CAF5044" }}>
                                <Feather name="plus" size={18} color="#4CAF50" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ color: "#4CAF50", fontFamily: F.regular, fontSize: 12 }}>غير محدودة — اضغط ∞ للتحديد</Text>
                            </View>
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

      {/* ─── Broadcast Notification Modal ─────────────────── */}
      <Modal
        visible={showBroadcastModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBroadcastModal(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000099" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16, borderTopWidth: 1, borderColor: colors.border }}>

            {/* Header */}
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 30 }}>🔔</Text>
              <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 19, textAlign: "center" }}>
                إشعار جماعي للعملاء
              </Text>
              <View style={{ backgroundColor: broadcastRemaining === 0 ? "#3A1A1A" : "#1A2A1A", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 }}>
                <Text style={{ color: broadcastRemaining === 0 ? "#EF9A9A" : "#81C784", fontFamily: F.bold, fontSize: 13 }}>
                  {broadcastRemaining === null ? "جارٍ التحقق..." : broadcastRemaining === 0 ? "انتهت إشعارات هذا الأسبوع" : `المتبقي هذا الأسبوع: ${broadcastRemaining} من 4`}
                </Text>
              </View>
            </View>

            {/* Title input */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.bold, fontSize: 13, textAlign: "right" }}>عنوان الإشعار</Text>
              <TextInput
                value={broadcastTitle}
                onChangeText={setBroadcastTitle}
                placeholder="مثال: عرض خاص اليوم فقط 🔥"
                placeholderTextColor={colors.mutedForeground}
                maxLength={100}
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontFamily: F.regular, fontSize: 14, textAlign: "right" }}
              />
            </View>

            {/* Body input */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.bold, fontSize: 13, textAlign: "right" }}>نص الرسالة</Text>
              <TextInput
                value={broadcastBody}
                onChangeText={setBroadcastBody}
                placeholder="اكتب تفاصيل العرض أو الخبر هنا..."
                placeholderTextColor={colors.mutedForeground}
                maxLength={300}
                multiline
                numberOfLines={3}
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontFamily: F.regular, fontSize: 14, textAlign: "right", minHeight: 80, textAlignVertical: "top" }}
              />
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowBroadcastModal(false); setBroadcastTitle(""); setBroadcastBody(""); }}
                style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.mutedForeground, fontFamily: F.bold, fontSize: 14 }}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={sendBroadcast}
                disabled={broadcastSending || broadcastRemaining === 0 || !broadcastTitle.trim() || !broadcastBody.trim()}
                style={{ flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: (broadcastRemaining === 0 || !broadcastTitle.trim() || !broadcastBody.trim()) ? colors.secondary : "#2E7D32", opacity: broadcastSending ? 0.7 : 1 }}
                activeOpacity={0.8}
              >
                {broadcastSending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="send" size={16} color="#fff" />
                }
                <Text style={{ color: "#fff", fontFamily: F.extra, fontSize: 15 }}>
                  {broadcastSending ? "جارٍ الإرسال..." : "إرسال لجميع العملاء"}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "column",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerRow1: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRow2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 16,
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
