import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { apiGet, apiPost, apiPatch, apiPut, apiDel } from "@/lib/api";
import {
  RefreshCw, Bell, Phone, MapPin, Printer, Clock, Truck, ClipboardList,
  Package, MessageCircle, CheckCircle, X, ChevronRight, ChevronLeft,
  BarChart2, User, Send, ArrowDown, UserPlus, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderStatus = "pending" | "preparing" | "ready" | "out_for_delivery" | "done" | "cancelled";
interface OrderItem { id: string; name: string; price: number; quantity: number; }
interface Order {
  id: number; dailyNumber: number | null; customerName: string; customerPhone: string;
  customerAddress: string | null; items: OrderItem[]; totalPrice: number; deliveryFee: number;
  discountCode: string | null; discountAmount: number | null; status: OrderStatus;
  paymentMethod: string; notes: string | null; createdAt: string;
}
interface Driver { id: number; name: string; phone: string; photoUrl: string | null; active: boolean; }
interface Assignment { driverId: number; driverName: string; status: string; }
interface ChatMsg { id: number; orderId: number; text: string; fromCashier: boolean; createdAt: string; readAt: string | null; }
interface ActiveAssignment {
  orderId: number; driverId: number; pickedUpAt: string | null;
  driverName: string; driverPhone: string;
  dailyNumber: number | null; customerName: string;
  customerAddress: string | null; totalPrice: number; paymentMethod: string;
  locationUpdatedAt: string | null;
}
interface AllDeliveryRow { orderId: number; dailyNumber: number | null; customerName: string; customerPhone: string; totalPrice: number; paymentMethod: string; driverName: string; deliveredAt: string | null; }

// ─── Constants ────────────────────────────────────────────────────────────────
const GOLD = "#E8920C";
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#E53935", preparing: "#FB8C00", ready: "#43A047",
  out_for_delivery: "#29B6F6", done: "#757575", cancelled: "#9E9E9E",
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "جديد", preparing: "قريباً يتجهز", ready: "جاري التجهيز",
  out_for_delivery: "قيد التوصيل", done: "تم التسليم", cancelled: "ملغى",
};
const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = { pending: "preparing", preparing: "ready" };
const STATUS_NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "قريبه تجهيز الطلب", preparing: "جاري تحضير الطلب",
};
type CashierView = "orders" | "pickup" | "drivers";
type FilterKey = OrderStatus | "all";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt2 = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(2);
const sar  = (h: number) => `${fmt2(h / 100)} ر.س`;
const sarRaw = (h: number) => fmt2(h / 100);

function printReceipt(order: Order) {
  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const itemsSubtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0) / 100;
  const deliveryFee   = (order.deliveryFee ?? 0) / 100;
  const totalPaid     = order.totalPrice / 100;
  const discount      = Math.max(0, itemsSubtotal + deliveryFee - totalPaid);
  const itemsRows = order.items.map(i => `<tr><td style="padding:4px 8px;text-align:left;">${fmt2(i.price*i.quantity/100)} ر.س</td><td style="padding:4px 8px;text-align:right;">${i.name}</td><td style="padding:4px 8px;text-align:center;">${i.quantity}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>إيصال #${order.dailyNumber ?? order.id}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo',sans-serif;background:#fff;color:#111;direction:rtl;padding:10mm;}
h1{text-align:center;font-size:18px;font-weight:800;color:#8B4513;margin-bottom:4px}.sub{text-align:center;font-size:11px;color:#888;margin-bottom:16px}
.daily{text-align:center;font-size:18px;font-weight:800;margin:8px 0;color:#8B4513}
table{width:100%;border-collapse:collapse;font-size:13px}thead th{background:#8B4513;color:#fff;padding:7px 8px;text-align:center}
tbody tr:nth-child(even){background:#fafafa}hr{border:none;border-top:1px dashed #bbb;margin:8px 0}
.total{font-size:16px;font-weight:800;text-align:left}@media print{body{padding:5mm}}</style></head><body>
<h1>روابي المندي للمذاق فن وأصول</h1>
<div class="sub">تبوك — المملكة العربية السعودية</div>
<div class="daily">طلب اليوم #${order.dailyNumber ?? order.id}</div>
<hr/>
<p style="font-size:13px;margin-bottom:3px"><strong>الاسم:</strong> ${order.customerName}</p>
${order.customerPhone ? `<p style="font-size:13px;margin-bottom:3px" dir="ltr"><strong>الجوال:</strong> ${order.customerPhone}</p>` : ""}
${order.customerAddress ? `<p style="font-size:13px;margin-bottom:6px"><strong>العنوان:</strong> ${order.customerAddress.startsWith("https://") ? "موقع GPS" : order.customerAddress}</p>` : ""}
<p style="font-size:13px;margin-bottom:3px"><strong>التاريخ:</strong> ${dateStr} ${timeStr}</p>
<p style="font-size:13px;margin-bottom:6px"><strong>الدفع:</strong> ${order.paymentMethod === "cash" ? "نقدي" : "إلكتروني"}</p>
<hr/>
<table><thead><tr><th>المبلغ</th><th>الصنف</th><th>الكمية</th></tr></thead><tbody>${itemsRows}</tbody></table>
<hr/>
${itemsSubtotal > 0 ? `<p style="font-size:12px;color:#555;text-align:left">${fmt2(itemsSubtotal)} ر.س المجموع</p>` : ""}
${deliveryFee > 0 ? `<p style="font-size:12px;color:#555;text-align:left">${fmt2(deliveryFee)} ر.س رسوم التوصيل</p>` : ""}
${discount > 0.005 ? `<p style="font-size:12px;color:#C8171A;text-align:left">- ${fmt2(discount)} ر.س خصم</p>` : ""}
<p class="total">${fmt2(totalPaid)} ر.س — الإجمالي</p>
${order.notes ? `<p style="margin-top:8px;font-size:12px;color:#555"><strong>ملاحظات:</strong> ${order.notes}</p>` : ""}
<p style="text-align:center;margin-top:14px;font-size:11px;color:#888">شكراً لاختيارك روابي المندي 🍗</p>
<script>window.onload=function(){window.print();}</script></body></html>`;
  const win = window.open("", "_blank", "width=500,height=700");
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Orders() {
  const queryClient = useQueryClient();

  // ── Core order state ───────────────────────────────────────────────────────
  const [cashierView, setCashierView] = useState<CashierView>("orders");
  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetching, setFetching]       = useState(false);
  const [filter, setFilter]           = useState<FilterKey>("all");
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const knownIds                       = useRef<Set<number>>(new Set());
  const pollRef                        = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirst                        = useRef(true);

  // ── Drivers ────────────────────────────────────────────────────────────────
  const [drivers, setDrivers]               = useState<Driver[]>([]);
  const [driversEnabled, setDriversEnabled] = useState(false);
  const [assignments, setAssignments]       = useState<Record<number, Assignment>>({});
  const [assigningOrderId, setAssigningOrderId] = useState<number | null>(null);

  // ── Active assignments (in-transit) ───────────────────────────────────────
  const [activeAssignments, setActiveAssignments]   = useState<ActiveAssignment[]>([]);
  const [activeLoading, setActiveLoading]           = useState(false);
  const [deliveringOrderId, setDeliveringOrderId]   = useState<number | null>(null);

  // ── All deliveries calendar ────────────────────────────────────────────────
  const [drvSelectedDate, setDrvSelectedDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [drvWeekOffset, setDrvWeekOffset]     = useState(0);
  const [allDeliveries, setAllDeliveries]     = useState<AllDeliveryRow[]>([]);
  const [allDeliveriesLoading, setAllDeliveriesLoading] = useState(false);
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());

  // ── Pickup time filter ─────────────────────────────────────────────────────
  const [pickupFromHour, setPickupFromHour] = useState("00");
  const [pickupToHour,   setPickupToHour]   = useState("23");
  const [pickupFromMin,  setPickupFromMin]  = useState("00");
  const [pickupToMin,    setPickupToMin]    = useState("59");

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [chatOrder, setChatOrder]     = useState<Order | null>(null);
  const [chatMsgs, setChatMsgs]       = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [unreadByOrder, setUnreadByOrder] = useState<Record<number, number>>({});
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Fetch orders ───────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setFetching(true);
    try {
      const data = await apiGet<Order[]>("/orders");
      if (!isFirst.current) {
        const newPending = data.filter(o => o.status === "pending" && !knownIds.current.has(o.id));
        if (newPending.length > 0) {
          setHasNewOrder(true);
          setTimeout(() => setHasNewOrder(false), 5000);
          document.title = `(${data.filter(o => o.status === "pending").length}) طلب جديد 🔔 | الطلبات`;
        }
      } else {
        const p = data.filter(o => o.status === "pending").length;
        if (p > 0) document.title = `(${p}) طلب جديد 🔔 | الطلبات`;
      }
      data.forEach(o => knownIds.current.add(o.id));
      isFirst.current = false;
      setOrders(data);
      queryClient.setQueryData(getListOrdersQueryKey(), data);
    } catch { /* silent */ }
    finally { setLoading(false); setFetching(false); }
  }, [queryClient]);

  // ── Fetch drivers + assignments ────────────────────────────────────────────
  const fetchDriversData = useCallback(async () => {
    try {
      const [drvList, drvEn] = await Promise.all([
        apiGet<Driver[]>("/drivers"),
        apiGet<{ enabled: boolean }>("/settings/drivers-enabled"),
      ]);
      setDrivers(drvList.filter(d => d.active));
      setDriversEnabled(drvEn.enabled);
    } catch {}
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const map = await apiGet<Record<number, Assignment>>("/orders/assignments");
      setAssignments(map);
    } catch {}
  }, []);

  const loadActiveAssignments = useCallback(async () => {
    setActiveLoading(true);
    try {
      const data = await apiGet<ActiveAssignment[]>("/drivers/active-assignments");
      setActiveAssignments(data);
    } catch {} finally { setActiveLoading(false); }
  }, []);

  const loadAllDeliveries = useCallback(async (date: Date) => {
    setAllDeliveriesLoading(true);
    try {
      const dateStr = date.toISOString().slice(0, 10);
      const data = await apiGet<AllDeliveryRow[]>(`/drivers/all-deliveries?date=${dateStr}`);
      setAllDeliveries(data);
    } catch {} finally { setAllDeliveriesLoading(false); }
  }, []);

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const convos = await apiGet<{ orderId: number; unread: number }[]>("/messages/conversations");
      const counts: Record<number, number> = {};
      for (const c of convos) if (c.unread > 0) counts[c.orderId] = c.unread;
      setUnreadByOrder(counts);
    } catch {}
  }, []);

  // ── Assign / unassign driver ───────────────────────────────────────────────
  const assignDriver = useCallback(async (orderId: number, driverId: number) => {
    try {
      await apiPost(`/orders/${orderId}/assign-driver`, { driverId });
      const map = await apiGet<Record<number, Assignment>>("/orders/assignments");
      setAssignments(map);
      setAssigningOrderId(null);
    } catch { alert("تعذّر تعيين المندوب"); }
  }, []);

  const unassignDriver = useCallback(async (orderId: number) => {
    try {
      await apiDel(`/orders/${orderId}/assign-driver`);
      setAssignments(prev => { const n = { ...prev }; delete n[orderId]; return n; });
    } catch {}
  }, []);

  // ── Update order status ────────────────────────────────────────────────────
  const handleUpdateStatus = useCallback(async (order: Order, newStatus: OrderStatus) => {
    try {
      const updated = await apiPatch<Order>(`/orders/${order.id}/status`, { status: newStatus });
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch { alert("تعذر تحديث الحالة"); }
  }, [queryClient]);

  const handleCancelOrder = useCallback(async (order: Order) => {
    if (!window.confirm(`إلغاء طلب #${order.dailyNumber} — ${order.customerName}؟`)) return;
    try {
      const updated = await apiPatch<Order>(`/orders/${order.id}/status`, { status: "cancelled" });
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch { alert("تعذر إلغاء الطلب"); }
  }, [queryClient]);

  const confirmDelivery = useCallback(async (orderId: number) => {
    setDeliveringOrderId(orderId);
    try {
      await apiPut(`/orders/${orderId}/driver-status`, { status: "delivered" });
      setActiveAssignments(prev => prev.filter(a => a.orderId !== orderId));
      await loadAllDeliveries(drvSelectedDate);
    } catch { alert("تعذّر تأكيد التسليم"); }
    setDeliveringOrderId(null);
  }, [drvSelectedDate, loadAllDeliveries]);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const openChat = useCallback(async (order: Order) => {
    setChatOrder(order);
    setChatLoading(true);
    setChatMsgs([]);
    try {
      const msgs = await apiGet<ChatMsg[]>(`/messages/order/${order.id}`);
      setChatMsgs(msgs);
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
      setChatMsgs(prev => [...prev, msg]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { setChatInput(text); } finally { setChatSending(false); }
  }, [chatOrder, chatInput]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchOrders();
    fetchDriversData();
    fetchAssignments();
    fetchUnreadCounts();
    pollRef.current = setInterval(() => {
      fetchOrders(true);
      fetchAssignments();
      fetchUnreadCounts();
    }, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.title = "روابي المندي";
    };
  }, [fetchOrders, fetchDriversData, fetchAssignments, fetchUnreadCounts]);

  useEffect(() => {
    if (cashierView !== "drivers") return;
    loadActiveAssignments();
    loadAllDeliveries(drvSelectedDate);
    const t = setInterval(() => { loadActiveAssignments(); loadAllDeliveries(drvSelectedDate); }, 10000);
    return () => clearInterval(t);
  }, [cashierView, loadActiveAssignments, loadAllDeliveries, drvSelectedDate]);

  useEffect(() => {
    if (!chatOrder) {
      if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; }
      return;
    }
    chatPollRef.current = setInterval(async () => {
      try {
        const msgs = await apiGet<ChatMsg[]>(`/messages/order/${chatOrder.id}`);
        setChatMsgs(msgs);
        await apiPatch(`/messages/order/${chatOrder.id}/read`, { fromCashier: true });
      } catch {}
    }, 5000);
    return () => { if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; } };
  }, [chatOrder]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalUnread     = Object.values(unreadByOrder).reduce((s, n) => s + n, 0);
  const pendingCount    = orders.filter(o => o.status === "pending").length;
  const pickupOrders    = orders.filter(o => o.notes?.includes("استلام من الفرع"));
  const pickupPending   = pickupOrders.filter(o => !["done","cancelled"].includes(o.status)).length;

  const filteredOrders  = filter === "all"
    ? orders.filter(o => !["done","cancelled"].includes(o.status))
    : orders.filter(o => o.status === filter);

  // ─── TAB NAV ──────────────────────────────────────────────────────────────
  const tabs = [
    { key: "orders"  as CashierView, label: "استقبال الطلبات", icon: <ClipboardList size={20}/>, color: GOLD,      badge: pendingCount },
    { key: "pickup"  as CashierView, label: "تسليم الفرع",     icon: <Package size={20}/>,       color: "#82B1FF",  badge: pickupPending },
    { key: "drivers" as CashierView, label: "المناديب",         icon: <Truck size={20}/>,         color: "#4CAF50",  badge: activeAssignments.length },
  ];

  // ─── ORDER CARD ───────────────────────────────────────────────────────────
  function OrderCard({ order }: { order: Order }) {
    const nextStatus   = STATUS_NEXT[order.status];
    const nextLabel    = STATUS_NEXT_LABEL[order.status];
    const isPickup     = !!order.notes?.includes("استلام من الفرع");
    const isDelivery   = !isPickup && (!!order.customerAddress || !!order.notes?.includes("توصيل"));
    const aRow         = assignments[order.id];
    const hasAssigned  = order.status === "ready" && aRow?.status === "assigned";
    const driverPickedUp = aRow?.status === "picked_up";
    const isGPS        = order.customerAddress?.startsWith("https://");
    const time = new Date(order.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    const date = new Date(order.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
    const color        = STATUS_COLOR[order.status];
    const unread       = unreadByOrder[order.id] ?? 0;

    return (
      <div dir="rtl" style={{ backgroundColor: "var(--color-card, #1a1008)", border: `1px solid var(--color-border, #2a1a0a)`, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
        {/* Card header */}
        <div style={{ borderBottom: "1px solid var(--color-border, #2a1a0a)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ backgroundColor: color + "22", border: `1px solid ${color}`, borderRadius: 8, padding: "2px 10px", color, fontWeight: 700, fontSize: 13 }}>
              {STATUS_LABEL[order.status]}
            </span>
            {isPickup && (
              <span style={{ backgroundColor: "#82B1FF22", border: "1px solid #82B1FF55", borderRadius: 8, padding: "2px 8px", color: "#82B1FF", fontSize: 11, fontWeight: 700 }}>🏪 فرع</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ backgroundColor: GOLD + "22", border: `1px solid ${GOLD}55`, borderRadius: 8, padding: "3px 10px", color: GOLD, fontWeight: 800, fontSize: 14 }}>
              طلب اليوم #{order.dailyNumber ?? order.id}
            </span>
            <div style={{ textAlign: "left", lineHeight: 1.4 }}>
              <div style={{ color: "var(--color-muted-foreground)", fontSize: 12 }}>{time}</div>
              <div style={{ color: "var(--color-muted-foreground)", fontSize: 11 }}>{date}</div>
            </div>
          </div>
        </div>

        {/* Customer info */}
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <User size={14} style={{ color: "var(--color-muted-foreground)" }} />
            <span style={{ color: "var(--color-foreground)", fontWeight: 700, fontSize: 15 }}>{order.customerName}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Phone size={14} style={{ color: "var(--color-muted-foreground)" }} />
            <span dir="ltr" style={{ color: "var(--color-muted-foreground)", fontSize: 13, fontWeight: 600 }}>{order.customerPhone}</span>
          </div>
          {order.customerAddress && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <MapPin size={14} style={{ color: isGPS ? "#4CAF50" : "var(--color-muted-foreground)" }} />
              {isGPS ? (
                <a href={order.customerAddress} target="_blank" rel="noreferrer" style={{ color: "#4CAF50", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                  📍 فتح الموقع على الخريطة
                </a>
              ) : (
                <span style={{ color: "var(--color-muted-foreground)", fontSize: 13 }}>{order.customerAddress}</span>
              )}
            </div>
          )}
        </div>

        {/* Items */}
        <div style={{ borderTop: "1px solid var(--color-border, #2a1a0a)", borderBottom: "1px solid var(--color-border, #2a1a0a)", padding: "8px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>{sar(item.price * item.quantity)}</span>
              <span style={{ color: "var(--color-foreground)", fontWeight: 600, fontSize: 13 }}>{item.name} × {item.quantity}</span>
            </div>
          ))}
        </div>

        {/* Discount */}
        {order.discountCode && order.discountAmount != null && (
          <div style={{ backgroundColor: "#1A0A0A", borderBottom: "1px solid #C8171A33", padding: "6px 14px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#C8171A", fontWeight: 700, fontSize: 13 }}>- {sar(order.discountAmount)}</span>
            <span style={{ color: "#E57373", fontWeight: 600, fontSize: 13 }}>🏷️ {order.discountCode}</span>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div style={{ backgroundColor: "var(--color-secondary)", padding: "6px 14px", display: "flex", gap: 6 }}>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>ملاحظة:</span>
            <span style={{ color: "var(--color-foreground)", fontSize: 13 }}>{order.notes}</span>
          </div>
        )}

        {/* Footer: total + payment */}
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted-foreground)", fontSize: 13 }}>
            {order.paymentMethod === "cash" ? "💵 نقدي" : "💳 إلكتروني"}
          </span>
          <span style={{ color: GOLD, fontWeight: 800, fontSize: 18 }}>{sar(order.totalPrice)}</span>
        </div>

        {/* Actions */}
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Advance status: pending→preparing, preparing→ready */}
          {nextStatus && nextLabel && order.status !== "ready" && (
            <button onClick={() => handleUpdateStatus(order, nextStatus)} style={{ backgroundColor: STATUS_COLOR[nextStatus], border: "none", borderRadius: 12, padding: "12px", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%" }}>
              {nextLabel}
            </button>
          )}

          {/* Ready + pickup → direct handoff */}
          {order.status === "ready" && isPickup && (
            <button onClick={() => handleUpdateStatus(order, "done")} style={{ backgroundColor: "#0D1F35", border: "1.5px solid #82B1FF", borderRadius: 12, padding: "12px", color: "#82B1FF", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🏪</span> ✅ تم تسليم الطلب للعميل
            </button>
          )}

          {/* Ready + delivery → driver section */}
          {order.status === "ready" && isDelivery && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {driverPickedUp ? (
                <div style={{ backgroundColor: "#0A2A0A", borderRadius: 14, padding: 14, border: "1.5px solid #4CAF50", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>🛵</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#4CAF50", fontWeight: 800, fontSize: 15 }}>{aRow!.driverName}</div>
                    <div style={{ color: "#4CAF50BB", fontSize: 12 }}>في الطريق — بانتظار التسليم للعميل</div>
                  </div>
                  <span style={{ backgroundColor: "#4CAF5022", borderRadius: 8, padding: "4px 8px", color: "#4CAF50", fontWeight: 700, fontSize: 11 }}>🚗 في الطريق</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={hasAssigned ? () => handleUpdateStatus(order, "done") : undefined}
                    disabled={!hasAssigned}
                    style={{ backgroundColor: hasAssigned ? "#1A3A1A" : "#1E1E1E", border: hasAssigned ? "1.5px solid #4CAF50" : "1px solid #444", borderRadius: 12, padding: "12px", color: hasAssigned ? "#4CAF50" : "#666", fontWeight: 700, fontSize: 14, cursor: hasAssigned ? "pointer" : "default", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 18 }}>🛵</span>
                    <div style={{ textAlign: "center" }}>
                      <div>تسليم الطلب للمندوب</div>
                      {!hasAssigned && <div style={{ color: "#555", fontSize: 11, fontWeight: 400 }}>عيّن مندوباً أولاً 🔒</div>}
                      {hasAssigned && <div style={{ color: "#4CAF50AA", fontSize: 11 }}>{aRow!.driverName}</div>}
                    </div>
                  </button>

                  {aRow ? (
                    <div style={{ backgroundColor: "#0A1F0A", borderRadius: 10, padding: "10px 12px", border: "1px solid #2E7D3244", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <button onClick={() => unassignDriver(order.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <X size={14} style={{ color: "#9E9E9E" }} />
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div>
                          <div style={{ color: "#4CAF50", fontWeight: 700, fontSize: 13 }}>{aRow.driverName}</div>
                          <div style={{ color: "#4CAF50AA", fontSize: 11 }}>المندوب المعيّن — بانتظار التسليم</div>
                        </div>
                        <span style={{ fontSize: 15 }}>🛵</span>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAssigningOrderId(order.id)} style={{ backgroundColor: "#0A1A0A", border: "1px solid #2E7D32", borderRadius: 12, padding: "12px", color: "#4CAF50", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>➕</span> تعيين مندوب
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Driver picker inline */}
          {assigningOrderId === order.id && (
            <div style={{ backgroundColor: "#0F1A0F", borderRadius: 12, padding: 14, border: "1px solid #2E7D32", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button onClick={() => setAssigningOrderId(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={16} style={{ color: "#9E9E9E" }} />
                </button>
                <span style={{ color: "#4CAF50", fontWeight: 700, fontSize: 13 }}>اختر مندوباً للطلب</span>
              </div>
              {drivers.length === 0 ? (
                <p style={{ color: "#9E9E9E", fontSize: 12, textAlign: "center" }}>لا يوجد مناديب نشطون</p>
              ) : drivers.map(d => (
                <button key={d.id} onClick={() => assignDriver(order.id, d.id)} style={{ backgroundColor: "#1A2A1A", borderRadius: 10, padding: "10px 12px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#2A3A2A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛵</div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{d.name}</div>
                    <div style={{ color: "#9E9E9E", fontSize: 11 }}>{d.phone}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Cancel */}
          {!["done","cancelled"].includes(order.status) && !driverPickedUp && (
            <button onClick={() => handleCancelOrder(order)} style={{ backgroundColor: "transparent", border: "1px solid #9E9E9E", borderRadius: 12, padding: "10px", color: "#9E9E9E", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <X size={14}/> إلغاء الطلب
            </button>
          )}

          {/* Chat */}
          <button onClick={() => openChat(order)} style={{ backgroundColor: "#0D2030", border: "1px solid #1E4A6A", borderRadius: 12, padding: "10px", color: "#64B5F6", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <MessageCircle size={16} style={{ color: "#64B5F6" }} />
              {unread > 0 && (
                <span style={{ position: "absolute", top: -5, right: -5, backgroundColor: "#E53935", borderRadius: "50%", minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", fontWeight: 700, padding: "0 2px" }}>{unread}</span>
              )}
            </div>
            مراسلة العميل{unread > 0 ? `  •  ${unread} جديدة` : ""}
          </button>

          {/* Print */}
          <button onClick={() => printReceipt(order)} style={{ backgroundColor: "#1A2A3A", border: "none", borderRadius: 12, padding: "10px", color: "#64B5F6", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Printer size={15}/> طباعة الإيصال
          </button>
        </div>
      </div>
    );
  }

  // ─── PICKUP VIEW ─────────────────────────────────────────────────────────
  function PickupView() {
    const fromMins   = parseInt(pickupFromHour) * 60 + parseInt(pickupFromMin);
    const toMins     = parseInt(pickupToHour)   * 60 + parseInt(pickupToMin);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayPickup   = pickupOrders.filter(o => new Date(o.createdAt) >= todayStart);
    const todayDone     = todayPickup.filter(o => o.status === "done");
    const todayTotal    = todayDone.reduce((s, o) => s + o.totalPrice / 100, 0);
    const todayPending  = todayPickup.filter(o => !["done","cancelled"].includes(o.status)).length;
    const filtered      = pickupOrders.filter(o => { const d = new Date(o.createdAt); const m = d.getHours() * 60 + d.getMinutes(); return m >= fromMins && m <= toMins; });
    const activeFiltered = filtered.filter(o => !["done","cancelled"].includes(o.status));
    const doneFiltered   = filtered.filter(o => o.status === "done");
    const filteredTotal  = doneFiltered.reduce((s, o) => s + o.totalPrice / 100, 0);

    return (
      <div dir="rtl" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "var(--color-foreground)", fontWeight: 800, fontSize: 18 }}>🏪 تسليم من الفرع</div>
            <div style={{ color: "var(--color-muted-foreground)", fontSize: 12, marginTop: 2 }}>
              {new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <div style={{ backgroundColor: "#82B1FF22", borderRadius: 14, padding: "8px 16px", border: "1px solid #82B1FF44", textAlign: "center" }}>
            <div style={{ color: "#82B1FF", fontWeight: 800, fontSize: 22 }}>{todayPending}</div>
            <div style={{ color: "#82B1FF", fontSize: 10, fontWeight: 600 }}>بانتظار</div>
          </div>
        </div>

        {/* Daily summary */}
        <div style={{ backgroundColor: "var(--color-card)", borderRadius: 16, border: `1px solid ${GOLD}44`, overflow: "hidden" }}>
          <div style={{ backgroundColor: GOLD + "11", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={15} style={{ color: GOLD }} />
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>إجمالي المبيعات اليوم</span>
          </div>
          <div style={{ display: "flex", padding: 14, gap: 10 }}>
            {[
              { value: todayTotal.toFixed(2), label: "ر.س إجمالي", color: "#4CAF50" },
              { value: String(todayDone.length), label: "طلب مكتمل", color: "#82B1FF" },
              { value: String(todayPending), label: "بانتظار", color: GOLD },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, backgroundColor: s.color + "11", borderRadius: 14, padding: 14, border: `1px solid ${s.color}33`, textAlign: "center" }}>
                <div style={{ color: s.color, fontWeight: 800, fontSize: 22 }}>{s.value}</div>
                <div style={{ color: s.color, fontWeight: 600, fontSize: 12 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Time filter */}
        <div style={{ backgroundColor: "var(--color-card)", borderRadius: 16, padding: 14, border: "1px solid #82B1FF33", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={15} style={{ color: "#82B1FF" }} />
            <span style={{ color: "#82B1FF", fontWeight: 700, fontSize: 14 }}>تصفية بالوقت</span>
          </div>
          {(["من","إلى"] as const).map((lbl, idx) => {
            const [h, setH] = idx === 0 ? [pickupFromHour, setPickupFromHour] : [pickupToHour, setPickupToHour];
            const [m, setM] = idx === 0 ? [pickupFromMin, setPickupFromMin] : [pickupToMin, setPickupToMin];
            return (
              <div key={lbl} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ color: "var(--color-muted-foreground)", fontWeight: 600, fontSize: 12, textAlign: "right" }}>{lbl} الساعة</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, direction: "rtl" }}>
                  <input value={h} onChange={e => setH(e.target.value.replace(/\D/g,"").slice(0,2))} maxLength={2} placeholder={idx === 0 ? "00" : "23"} style={{ flex: 1, backgroundColor: "var(--color-secondary)", borderRadius: 12, border: "1px solid #82B1FF44", color: "#82B1FF", fontWeight: 800, fontSize: 22, textAlign: "center", padding: "10px 0", outline: "none" }} />
                  <span style={{ color: "var(--color-muted-foreground)", fontWeight: 800, fontSize: 20 }}>:</span>
                  <input value={m} onChange={e => setM(e.target.value.replace(/\D/g,"").slice(0,2))} maxLength={2} placeholder={idx === 0 ? "00" : "59"} style={{ flex: 1, backgroundColor: "var(--color-secondary)", borderRadius: 12, border: "1px solid #82B1FF44", color: "#82B1FF", fontWeight: 800, fontSize: 22, textAlign: "center", padding: "10px 0", outline: "none" }} />
                </div>
                {idx === 0 && <div style={{ textAlign: "center" }}><ArrowDown size={18} style={{ color: "var(--color-muted-foreground)" }} /></div>}
              </div>
            );
          })}
          {(doneFiltered.length > 0 || activeFiltered.length > 0) && (
            <div style={{ backgroundColor: "#82B1FF0D", borderRadius: 12, padding: 10, display: "flex", justifyContent: "space-around", border: "1px solid #82B1FF22" }}>
              {[{ value: filteredTotal.toFixed(2), label: "ر.س في النطاق", color: "#82B1FF" }, { value: String(doneFiltered.length), label: "مكتمل", color: "#4CAF50" }, { value: String(activeFiltered.length), label: "بانتظار", color: GOLD }].map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ color: s.color, fontWeight: 800, fontSize: 16 }}>{s.value}</div>
                  <div style={{ color: "var(--color-muted-foreground)", fontSize: 10, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active pickup orders */}
        {activeFiltered.length === 0 ? (
          <div style={{ backgroundColor: "var(--color-card)", borderRadius: 16, padding: 28, textAlign: "center", border: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🏪</div>
            <div style={{ color: "var(--color-muted-foreground)", fontWeight: 600, fontSize: 14 }}>لا يوجد طلبات استلام في هذا النطاق</div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#82B1FF" }} />
              <span style={{ color: "var(--color-foreground)", fontWeight: 700, fontSize: 14 }}>بانتظار الاستلام ({activeFiltered.length})</span>
            </div>
            {activeFiltered.map(order => {
              const d = new Date(order.createdAt);
              const timeStr = d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
              const dateStr = d.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
              return (
                <div key={order.id} style={{ backgroundColor: "var(--color-card)", borderRadius: 16, border: "1px solid #82B1FF44", overflow: "hidden", marginBottom: 8 }}>
                  {/* top */}
                  <div style={{ backgroundColor: "#82B1FF11", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ backgroundColor: "#82B1FF22", padding: "3px 8px", borderRadius: 8, color: "#82B1FF", fontWeight: 800, fontSize: 14 }}>#{order.dailyNumber ?? order.id}</span>
                      <span style={{ color: "var(--color-foreground)", fontWeight: 700, fontSize: 15 }}>{order.customerName}</span>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ color: "#82B1FF", fontWeight: 800, fontSize: 16 }}>{sar(order.totalPrice)}</div>
                      <span style={{ backgroundColor: STATUS_COLOR[order.status] + "22", padding: "2px 7px", borderRadius: 8, color: STATUS_COLOR[order.status], fontSize: 11, fontWeight: 700 }}>{STATUS_LABEL[order.status]}</span>
                    </div>
                  </div>
                  {/* items */}
                  <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 3 }}>
                    {order.items.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--color-muted-foreground)", fontSize: 12 }}>{sarRaw(item.price * item.quantity)}</span>
                        <span style={{ color: "var(--color-foreground)", fontWeight: 600, fontSize: 13 }}>× {item.quantity}  {item.name}</span>
                      </div>
                    ))}
                  </div>
                  {/* time + phone */}
                  <div style={{ padding: "0 14px 8px", display: "flex", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Calendar size={13} style={{ color: "var(--color-muted-foreground)" }} />
                      <span style={{ color: "var(--color-muted-foreground)", fontSize: 12 }}>{dateStr}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={13} style={{ color: "var(--color-muted-foreground)" }} />
                      <span style={{ color: "var(--color-muted-foreground)", fontSize: 12 }}>{timeStr}</span>
                    </div>
                  </div>
                  {order.customerPhone && (
                    <a href={`tel:${order.customerPhone}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px 10px", textDecoration: "none" }}>
                      <Phone size={13} style={{ color: "#82B1FF" }} />
                      <span style={{ color: "#82B1FF", fontWeight: 600, fontSize: 13 }}>{order.customerPhone}</span>
                    </a>
                  )}
                  {/* action buttons */}
                  <div style={{ display: "flex", borderTop: "1px solid #82B1FF22" }}>
                    <button onClick={() => printReceipt(order)} style={{ flex: 1, backgroundColor: "#0D1A0D", border: "none", borderRight: "1px solid #82B1FF22", padding: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: GOLD, fontWeight: 700, fontSize: 13 }}>
                      <Printer size={15} style={{ color: GOLD }} /> طباعة الفاتورة
                    </button>
                    <button onClick={() => handleUpdateStatus(order, "done")} style={{ flex: 1, backgroundColor: "#0D1F35", border: "none", padding: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#82B1FF", fontWeight: 800, fontSize: 13 }}>
                      <CheckCircle size={15} style={{ color: "#82B1FF" }} /> ✅ تم التسليم
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Done pickup orders */}
        {doneFiltered.length > 0 && (
          <div>
            <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "4px 0 8px" }} />
            <div style={{ color: "var(--color-muted-foreground)", fontWeight: 600, fontSize: 13, marginBottom: 8 }}>✅ تم استلامها ({doneFiltered.length})</div>
            {doneFiltered.map(order => {
              const d = new Date(order.createdAt);
              const timeStr = d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
              return (
                <div key={order.id} style={{ backgroundColor: "var(--color-card)", borderRadius: 14, border: "1px solid #4CAF5033", overflow: "hidden", opacity: 0.85, marginBottom: 6 }}>
                  <div style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#4CAF50", fontWeight: 700, fontSize: 14 }}>{sar(order.totalPrice)}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "var(--color-foreground)", fontWeight: 600, fontSize: 13 }}>{order.customerName}</span>
                        <span style={{ color: "#4CAF50", fontWeight: 800, fontSize: 13 }}>#{order.dailyNumber ?? order.id}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                      <Clock size={12} style={{ color: "var(--color-muted-foreground)" }} />
                      <span style={{ color: "var(--color-muted-foreground)", fontSize: 11 }}>{timeStr}</span>
                    </div>
                  </div>
                  <button onClick={() => printReceipt(order)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#0D1A0D", border: "none", borderTop: "1px solid #4CAF5022", padding: "9px", cursor: "pointer", width: "100%", color: GOLD, fontWeight: 700, fontSize: 12 }}>
                    <Printer size={13} style={{ color: GOLD }} /> إعادة طباعة الفاتورة
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── DRIVERS VIEW ─────────────────────────────────────────────────────────
  function DriversView() {
    const DAY_ABBR = ["ح","ن","ث","ر","خ","ج","س"];
    const today0 = new Date(); today0.setHours(0,0,0,0);
    const weekDays: Date[] = (() => {
      const anchor = new Date(today0);
      anchor.setDate(today0.getDate() - today0.getDay() + drvWeekOffset * 7);
      return Array.from({ length: 7 }, (_, i) => { const d = new Date(anchor); d.setDate(anchor.getDate() + i); return d; });
    })();
    const isToday    = (d: Date) => d.toDateString() === today0.toDateString();
    const isSelected = (d: Date) => d.toDateString() === drvSelectedDate.toDateString();
    const isFuture   = (d: Date) => d > today0;
    const monthLabel = weekDays[3].toLocaleDateString("ar-SA", { month: "long", year: "numeric" });
    const totalCollected = allDeliveries.reduce((s, r) => s + r.totalPrice, 0);
    const cashCollected  = allDeliveries.filter(r => r.paymentMethod === "cash").reduce((s, r) => s + r.totalPrice, 0);
    const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "--:--";

    // Group deliveries by driver
    const driverMap = new Map<string, AllDeliveryRow[]>();
    for (const r of allDeliveries) {
      const key = r.driverName || "غير محدد";
      if (!driverMap.has(key)) driverMap.set(key, []);
      driverMap.get(key)!.push(r);
    }

    return (
      <div dir="rtl">
        {/* Calendar */}
        <div style={{ backgroundColor: "#0D0D0D", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 10px 6px" }}>
            <button onClick={() => setDrvWeekOffset(p => p + 1)} disabled={drvWeekOffset >= 0} style={{ background: "none", border: "none", cursor: drvWeekOffset >= 0 ? "default" : "pointer", opacity: drvWeekOffset >= 0 ? 0.25 : 1, padding: 6 }}>
              <ChevronRight size={18} style={{ color: "var(--color-muted-foreground)" }} />
            </button>
            <span style={{ color: "var(--color-foreground)", fontWeight: 800, fontSize: 14 }}>{monthLabel}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => { setDrvWeekOffset(0); const d = new Date(); d.setHours(0,0,0,0); setDrvSelectedDate(d); loadAllDeliveries(d); setExpandedDrivers(new Set()); }} style={{ backgroundColor: "#1A2A1A", borderRadius: 8, padding: "4px 10px", border: "1px solid #4CAF5044", cursor: "pointer", color: "#4CAF50", fontWeight: 700, fontSize: 11 }}>اليوم</button>
              <button onClick={() => setDrvWeekOffset(p => p - 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                <ChevronLeft size={18} style={{ color: "var(--color-muted-foreground)" }} />
              </button>
            </div>
          </div>
          {/* Day abbreviations */}
          <div style={{ display: "flex", flexDirection: "row-reverse", padding: "0 8px" }}>
            {weekDays.map((_, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <span style={{ color: "var(--color-muted-foreground)", fontWeight: 600, fontSize: 10 }}>{DAY_ABBR[i]}</span>
              </div>
            ))}
          </div>
          {/* Date numbers */}
          <div style={{ display: "flex", flexDirection: "row-reverse", padding: "2px 6px 8px" }}>
            {weekDays.map((d, i) => {
              const sel = isSelected(d), tod = isToday(d), fut = isFuture(d);
              return (
                <button key={i} disabled={fut} onClick={() => { setDrvSelectedDate(d); loadAllDeliveries(d); setExpandedDrivers(new Set()); }} style={{ flex: 1, display: "flex", justifyContent: "center", padding: "3px 0", background: "none", border: "none", cursor: fut ? "default" : "pointer" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: sel ? "#4CAF50" : tod ? "#4CAF5022" : "transparent", border: tod && !sel ? "1px solid #4CAF5066" : "none" }}>
                    <span style={{ color: sel ? "#fff" : fut ? "var(--color-border)" : tod ? "#4CAF50" : "var(--color-foreground)", fontWeight: sel ? 800 : 600, fontSize: 13 }}>{d.getDate()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats summary */}
        <div style={{ display: "flex", flexDirection: "row-reverse", backgroundColor: "#111", borderBottom: "1px solid var(--color-border)", padding: "14px 0" }}>
          {[
            { icon: "🛒", label: "تم جمعها",       value: `SR ${totalCollected.toFixed(2)}`, color: "#4CAF50" },
            { icon: "📦", label: "عمليات التوصيل", value: String(allDeliveries.length),       color: GOLD },
            { icon: "💵", label: "نقدي",             value: `SR ${cashCollected.toFixed(2)}`,  color: "#81C784" },
            { icon: "🚗", label: "في الطريق",        value: String(activeAssignments.length),  color: "#82B1FF" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", borderRight: i < 3 ? "1px solid var(--color-border)" : "none" }}>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
              <div style={{ color: s.color, fontWeight: 800, fontSize: 14 }}>{s.value}</div>
              <div style={{ color: "var(--color-muted-foreground)", fontSize: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Active in-transit */}
          {activeAssignments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4CAF50" }} />
                <span style={{ color: "#4CAF50", fontWeight: 700, fontSize: 13 }}>🚗 بانتظار التسليم ({activeAssignments.length})</span>
                <div style={{ flex: 1 }} />
                <button onClick={loadActiveAssignments} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <RefreshCw size={12} style={{ color: "#4CAF50" }} />
                </button>
              </div>
              {activeAssignments.map(a => {
                const gpsLost = !a.locationUpdatedAt || (Date.now() - new Date(a.locationUpdatedAt).getTime() > 30000);
                return (
                  <div key={a.orderId} style={{ backgroundColor: "#0A1A0A", borderRadius: 14, border: `1px solid ${gpsLost ? "#F9A82544" : "#4CAF5044"}`, overflow: "hidden" }}>
                    {gpsLost && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#F9A82518", padding: "6px 12px", borderBottom: "1px solid #F9A82533" }}>
                        <span style={{ fontSize: 13 }}>⚠️</span>
                        <span style={{ color: "#F9A825", fontWeight: 700, fontSize: 12 }}>انقطع إشارة GPS للمندوب</span>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", padding: 12, gap: 10 }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                          <span style={{ backgroundColor: GOLD + "22", padding: "2px 7px", borderRadius: 7, color: GOLD, fontWeight: 800, fontSize: 12 }}>#{a.dailyNumber ?? a.orderId}</span>
                          <span style={{ color: "var(--color-foreground)", fontWeight: 600, fontSize: 13 }}>{a.customerName}</span>
                        </div>
                        <span style={{ color: "#4CAF50", fontWeight: 600, fontSize: 12 }}>🛵 {a.driverName}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span style={{ color: "#4CAF50", fontWeight: 800, fontSize: 15 }}>{a.totalPrice.toFixed(2)} ر.س</span>
                        <span style={{ color: "var(--color-muted-foreground)", fontWeight: 600, fontSize: 10 }}>{a.paymentMethod === "cash" ? "💵 نقدي" : "💳 إلكتروني"}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", borderTop: "1px solid #4CAF5033" }}>
                      {a.customerAddress?.startsWith("https://") && (
                        <a href={a.customerAddress} target="_blank" rel="noreferrer" style={{ flex: 1, backgroundColor: "#0A1A2A", padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, borderRight: "1px solid #4CAF5022", textDecoration: "none" }}>
                          <MapPin size={14} style={{ color: "#29B6F6" }} />
                          <span style={{ color: "#29B6F6", fontWeight: 800, fontSize: 12 }}>تتبع مباشر</span>
                        </a>
                      )}
                      <button onClick={() => confirmDelivery(a.orderId)} disabled={deliveringOrderId === a.orderId} style={{ flex: 2, backgroundColor: "#1A3A1A", border: "none", padding: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#4CAF50", fontWeight: 800, fontSize: 13 }}>
                        {deliveringOrderId === a.orderId ? "⏳" : <><CheckCircle size={14} style={{ color: "#4CAF50" }} /> ✅ تم التسليم للعميل</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* All deliveries for selected date grouped by driver */}
          {allDeliveriesLoading ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--color-muted-foreground)" }}>⏳ جار التحميل...</div>
          ) : allDeliveries.length === 0 ? (
            <div style={{ backgroundColor: "var(--color-card)", borderRadius: 16, padding: 28, textAlign: "center", border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 40 }}>🚗</div>
              <div style={{ color: "var(--color-muted-foreground)", fontWeight: 600, fontSize: 14, marginTop: 8 }}>لا يوجد توصيلات في هذا اليوم</div>
            </div>
          ) : (
            Array.from(driverMap.entries()).map(([name, rows]) => {
              const total = rows.reduce((s, r) => s + r.totalPrice, 0);
              const cash  = rows.filter(r => r.paymentMethod === "cash").reduce((s, r) => s + r.totalPrice, 0);
              const expanded = expandedDrivers.has(name);
              return (
                <div key={name} style={{ backgroundColor: "var(--color-card)", borderRadius: 16, border: "1px solid #4CAF5033", overflow: "hidden" }}>
                  <button onClick={() => setExpandedDrivers(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; })} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <ChevronLeft size={16} style={{ color: "#4CAF50", transform: expanded ? "rotate(-90deg)" : "none" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "var(--color-muted-foreground)", fontSize: 11 }}>{rows.length} طلب | نقدي: {cash.toFixed(2)} | الإجمالي: {total.toFixed(2)} ر.س</div>
                      </div>
                      <span style={{ color: "#4CAF50", fontWeight: 800, fontSize: 15 }}>🛵 {name}</span>
                    </div>
                  </button>
                  {expanded && (
                    <div style={{ borderTop: "1px solid #4CAF5033" }}>
                      {rows.map((r, i) => (
                        <div key={i} style={{ padding: "10px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "var(--color-muted-foreground)", fontSize: 11 }}>{fmtTime(r.deliveredAt)}</span>
                            <span style={{ color: r.paymentMethod === "cash" ? "#81C784" : "#64B5F6", fontSize: 12, fontWeight: 600 }}>{r.paymentMethod === "cash" ? "💵" : "💳"}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: "var(--color-foreground)", fontWeight: 600, fontSize: 13 }}>{r.customerName}</div>
                            <div style={{ color: "#4CAF50", fontWeight: 800, fontSize: 14 }}>{r.totalPrice.toFixed(2)} ر.س</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div dir="rtl">
      {/* Header */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            إدارة الطلبات
            {pendingCount > 0 && (
              <span style={{ backgroundColor: "#E53935", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: "50%", minWidth: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }} className="animate-pulse">
                {pendingCount}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 12, color: "var(--color-muted-foreground)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            تحديث تلقائي كل ١٠ ثوانٍ
            <span className={cn("inline-block w-2 h-2 rounded-full", fetching ? "bg-yellow-400 animate-ping" : "bg-green-500")} />
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasNewOrder && (
            <div className="animate-bounce" style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#E53935", color: "#fff", fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 9999 }}>
              <Bell size={14} /> طلب جديد وصل!
            </div>
          )}
          <button onClick={() => fetchOrders()} disabled={fetching} style={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <RefreshCw size={16} className={cn(fetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* New-order banner */}
      {cashierView === "orders" && hasNewOrder && (
        <div style={{ backgroundColor: "#E53935", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>طلب جديد وصل!</span>
          <span style={{ fontSize: 20 }}>🔔</span>
        </div>
      )}

      {/* Three-tab nav bar */}
      <div style={{ display: "flex", flexDirection: "row-reverse", backgroundColor: "var(--color-card)", borderRadius: 14, border: "1px solid var(--color-border)", overflow: "hidden", marginBottom: 14 }}>
        {tabs.map(tab => {
          const active = cashierView === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setCashierView(tab.key); if (tab.key === "drivers") { loadActiveAssignments(); loadAllDeliveries(drvSelectedDate); } }}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px", gap: 3, background: "none", border: "none", borderBottom: `3px solid ${active ? tab.color : "transparent"}`, cursor: "pointer" }}
            >
              <div style={{ position: "relative" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", backgroundColor: active ? tab.color + "22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: active ? tab.color : "var(--color-muted-foreground)" }}>{tab.icon}</span>
                </div>
                {tab.badge > 0 && (
                  <span style={{ position: "absolute", top: 0, left: 0, backgroundColor: "#E53935", borderRadius: "50%", minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 800, padding: "0 3px" }}>
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
              </div>
              <span style={{ color: active ? tab.color : "var(--color-muted-foreground)", fontWeight: active ? 700 : 400, fontSize: 12 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── ORDERS TAB ── */}
      {cashierView === "orders" && (
        <>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, overflowX: "auto" }}>
            {(["all","pending","preparing","ready","out_for_delivery","done","cancelled"] as const).map(key => {
              const label = key === "all" ? "الكل" : STATUS_LABEL[key as OrderStatus];
              const cnt   = key === "all" ? orders.filter(o => !["done","cancelled"].includes(o.status)).length : orders.filter(o => o.status === key).length;
              const clr   = key === "all" ? GOLD : STATUS_COLOR[key as OrderStatus];
              const active = filter === key;
              return (
                <button key={key} onClick={() => setFilter(key)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 10, border: active ? `1.5px solid ${clr}` : "1px solid var(--color-border)", backgroundColor: active ? clr + "22" : "var(--color-card)", cursor: "pointer" }}>
                  <span style={{ color: active ? clr : "var(--color-muted-foreground)", fontWeight: active ? 700 : 400, fontSize: 13 }}>{label}</span>
                  {cnt > 0 && <span style={{ backgroundColor: active ? clr + "33" : "var(--color-secondary)", color: active ? clr : "var(--color-muted-foreground)", borderRadius: "50%", minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{cnt}</span>}
                </button>
              );
            })}
          </div>

          {/* Print list button */}
          {!loading && filteredOrders.length > 0 && (
            <button onClick={() => { const w = window.open("","_blank","width=900,height=700"); if (w) { const rows = filteredOrders.map(o=>`<tr><td>#${o.dailyNumber??o.id}</td><td>${o.customerName}</td><td>${o.paymentMethod==="cash"?"نقدي":"إلكتروني"}</td><td>${STATUS_LABEL[o.status]}</td><td>${fmt2(o.totalPrice/100)} ر.س</td><td>${new Date(o.createdAt).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"})}</td></tr>`).join(""); w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>طلبات</title><style>body{font-family:Cairo,sans-serif;padding:10mm}table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #ddd;text-align:right}th{background:#8B4513;color:#fff}@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap')</style></head><body><h2>روابي المندي — الطلبات</h2><table><thead><tr><th>#</th><th>العميل</th><th>الدفع</th><th>الحالة</th><th>المبلغ</th><th>الوقت</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>`); w.document.close(); } }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, padding: "10px", borderRadius: 12, backgroundColor: "#1A2A3A", border: "1px solid #64B5F633", color: "#64B5F6", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%" }}>
              <Printer size={15} style={{ color: "#64B5F6" }} /> طباعة قائمة الطلبات ({filteredOrders.length})
            </button>
          )}

          {/* Orders list */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 40 }}>⏳</div>
              <div style={{ color: "var(--color-muted-foreground)", marginTop: 8 }}>جارٍ التحميل...</div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 48 }}>🍽️</div>
              <div style={{ color: "var(--color-muted-foreground)", fontWeight: 600, marginTop: 8 }}>لا توجد طلبات</div>
            </div>
          ) : (
            <div>
              {filteredOrders.map(order => <OrderCard key={order.id} order={order} />)}
            </div>
          )}

          <p style={{ textAlign: "center", color: "var(--color-muted-foreground)", fontSize: 12, marginTop: 8 }}>
            يعرض {filteredOrders.length} طلب{filter !== "all" ? ` من إجمالي ${orders.length}` : ""}
          </p>
        </>
      )}

      {/* ── PICKUP TAB ── */}
      {cashierView === "pickup" && <PickupView />}

      {/* ── DRIVERS TAB ── */}
      {cashierView === "drivers" && <DriversView />}

      {/* ── CHAT MODAL ── */}
      {chatOrder && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ backgroundColor: "var(--color-card)", borderTopLeftRadius: 24, borderTopRightRadius: 24, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--color-border)" }} dir="rtl">
            {/* Chat header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--color-border)" }}>
              <button onClick={() => setChatOrder(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={22} style={{ color: "var(--color-muted-foreground)" }} />
              </button>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>💬 مراسلة العميل</div>
                <div style={{ color: "var(--color-muted-foreground)", fontSize: 12 }}>طلب #{chatOrder.dailyNumber ?? chatOrder.id} — {chatOrder.customerName}</div>
              </div>
            </div>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {chatLoading ? (
                <div style={{ textAlign: "center", color: "var(--color-muted-foreground)" }}>⏳</div>
              ) : chatMsgs.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--color-muted-foreground)", marginTop: 24 }}>لا توجد رسائل بعد</div>
              ) : chatMsgs.map(msg => (
                <div key={msg.id} style={{ display: "flex", justifyContent: msg.fromCashier ? "flex-start" : "flex-end" }}>
                  <div style={{ maxWidth: "80%", backgroundColor: msg.fromCashier ? "#1A2A1A" : "var(--color-secondary)", borderRadius: 14, padding: "10px 14px", border: msg.fromCashier ? "1px solid #4CAF5033" : "1px solid var(--color-border)" }}>
                    <div style={{ fontSize: 14, color: "var(--color-foreground)" }}>{msg.text}</div>
                    <div style={{ fontSize: 10, color: "var(--color-muted-foreground)", marginTop: 4, textAlign: msg.fromCashier ? "right" : "left" }}>
                      {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      {msg.fromCashier && <span style={{ marginRight: 4 }}>{msg.readAt ? "✓✓" : "✓"}</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            {/* Input */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--color-border)", display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={sendChatMessage} disabled={chatSending || !chatInput.trim()} style={{ backgroundColor: chatInput.trim() ? "#4CAF50" : "var(--color-secondary)", border: "none", borderRadius: 10, padding: "10px 14px", cursor: chatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={16} style={{ color: chatInput.trim() ? "#fff" : "var(--color-muted-foreground)" }} />
              </button>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChatMessage()}
                placeholder="اكتب رسالة..."
                style={{ flex: 1, backgroundColor: "var(--color-secondary)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px", color: "var(--color-foreground)", fontSize: 14, textAlign: "right", outline: "none" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// small helper for calendar icon (not in lucide exports list above)
function Calendar({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
