import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey } from "@workspace/api-client-react";
import { apiGet, apiPost, apiPatch, apiPut, apiDel } from "@/lib/api";
import {
  RefreshCw, Bell, Phone, MapPin, Printer, Clock, Truck, ClipboardList,
  Package, MessageCircle, X, ChevronRight, ChevronLeft,
  BarChart2, User, Send, ArrowDown, CheckCircle, ChevronDown,
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

// ─── Legacy constants (used by PickupView / DriversView) ──────────────────────
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

// ─── New design-system constants (matching mockup) ────────────────────────────
const SAFFRON     = "#F2994A";
const SAFFRON_DIM = "rgba(242,153,74,.14)";
const CLR_READY   = "#3DD68C";
const CLR_READY_DIM = "rgba(61,214,140,.14)";
const CLR_DELIVERING     = "#4FA3F7";
const CLR_DELIVERING_DIM = "rgba(79,163,247,.14)";
const CLR_CANCELLED      = "#EF5A5A";
const CLR_CANCELLED_DIM  = "rgba(239,90,90,.14)";
const CLR_NEW     = "#C7A6FF";
const CLR_NEW_DIM = "rgba(199,166,255,.14)";
const BG       = "#14161B";
const SURFACE  = "#1B1E25";
const SURFACE2 = "#22252E";
const LINE     = "#2B2F39";
const TEXT     = "#EDEEF2";
const TEXT_DIM   = "#9297A6";
const TEXT_FAINT = "#5C6170";

const STATUS_CARD_COLOR: Record<OrderStatus, string> = {
  pending: CLR_NEW, preparing: SAFFRON, ready: CLR_READY,
  out_for_delivery: CLR_DELIVERING, done: "#9297A6", cancelled: CLR_CANCELLED,
};
const STATUS_CARD_DIM: Record<OrderStatus, string> = {
  pending: CLR_NEW_DIM, preparing: SAFFRON_DIM, ready: CLR_READY_DIM,
  out_for_delivery: CLR_DELIVERING_DIM, done: "rgba(146,151,166,.14)", cancelled: CLR_CANCELLED_DIM,
};
const STATUS_DISPLAY: Record<OrderStatus, string> = {
  pending: "جديد", preparing: "جاري التجهيز", ready: "جاهز للتسليم",
  out_for_delivery: "قيد التوصيل", done: "تم التسليم", cancelled: "ملغى",
};
const RAIL_ORDER = ["pending","preparing","ready","out_for_delivery","done"];
const RAIL_STEPS = [
  { label: "جديد" }, { label: "التجهيز" }, { label: "جاهز" },
  { label: "التوصيل" }, { label: "تم" },
];
const ORDER_FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",              label: "الكل" },
  { key: "pending",          label: "جديد" },
  { key: "preparing",        label: "جاري التجهيز" },
  { key: "ready",            label: "جاهز للتسليم" },
  { key: "out_for_delivery", label: "قيد التوصيل" },
  { key: "cancelled",        label: "ملغى" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt2  = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(2);
const sar   = (h: number) => `${fmt2(h / 100)} ر.س`;
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

function printBulk(orders: Order[]) {
  if (orders.length === 0) return;
  const pages = orders.map(o => {
    const time = new Date(o.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    const itemsRows = o.items.map(i => `<tr><td style="padding:3px 6px">${i.name} × ${i.quantity}</td><td style="padding:3px 6px;text-align:left">${fmt2(i.price*i.quantity/100)} ر.س</td></tr>`).join("");
    return `<div style="page-break-after:always;padding:8mm;font-family:Cairo,sans-serif;direction:rtl">
<h2 style="text-align:center;color:#8B4513;font-size:16px;margin-bottom:4px">روابي المندي</h2>
<p style="text-align:center;font-size:14px;font-weight:700;margin-bottom:8px">طلب اليوم #${o.dailyNumber ?? o.id} — ${o.customerName}</p>
<p style="font-size:12px;color:#666;margin-bottom:6px">${time} · ${o.paymentMethod === "cash" ? "نقدي" : "إلكتروني"}</p>
<table style="width:100%;border-collapse:collapse;font-size:13px">${itemsRows}
<tr><td colspan="2" style="border-top:1px dashed #ccc;padding-top:6px;font-weight:700;font-size:15px">${fmt2(o.totalPrice/100)} ر.س</td></tr>
</table></div>`;
  }).join("");
  const win = window.open("", "_blank", "width=600,height=800");
  if (win) {
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet"></head><body>${pages}<script>window.onload=function(){window.print()}<\/script></body></html>`);
    win.document.close();
  }
}

// ─── Progress Rail ────────────────────────────────────────────────────────────
function ProgressRail({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return <div style={{ fontSize: 12, color: TEXT_FAINT, textAlign: "center", padding: "8px 0 14px" }}>تم إلغاء هذا الطلب</div>;
  }
  const idx = RAIL_ORDER.indexOf(status);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", margin: "4px 0 14px", padding: "0 2px" }}>
      {RAIL_STEPS.map((step, i) => {
        const done = i < idx;
        const current = i === idx;
        const active = done || current;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {i > 0 && (
              <div style={{ position: "absolute", top: 7, right: "50%", width: "100%", height: 2, backgroundColor: done ? SAFFRON : LINE, zIndex: 0 }} />
            )}
            <div style={{
              width: 16, height: 16, borderRadius: "50%",
              backgroundColor: active ? SAFFRON : LINE,
              border: `2px solid ${BG}`,
              zIndex: 1, position: "relative",
              ...(current ? { boxShadow: `0 0 0 4px ${SAFFRON_DIM}` } : {}),
            }} />
            <div style={{ fontSize: 10, color: active ? TEXT_DIM : TEXT_FAINT, marginTop: 6, textAlign: "center" }}>{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Orders() {
  const queryClient = useQueryClient();

  // ── Core order state ──────────────────────────────────────────────────────
  const [cashierView, setCashierView] = useState<CashierView>("orders");
  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetching, setFetching]       = useState(false);
  const [filter, setFilter]           = useState<FilterKey>("all");
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const knownIds  = useRef<Set<number>>(new Set());
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirst   = useRef(true);

  // ── UI state (new design) ─────────────────────────────────────────────────
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm]       = useState("");
  const [sortNewest, setSortNewest]       = useState(true);
  const [selectMode, setSelectMode]       = useState(false);
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());

  // ── Drivers ───────────────────────────────────────────────────────────────
  const [drivers, setDrivers]               = useState<Driver[]>([]);
  const [driversEnabled, setDriversEnabled] = useState(false);
  const [assignments, setAssignments]       = useState<Record<number, Assignment>>({});
  const [assigningOrderId, setAssigningOrderId] = useState<number | null>(null);

  // ── Active assignments ────────────────────────────────────────────────────
  const [activeAssignments, setActiveAssignments] = useState<ActiveAssignment[]>([]);
  const [activeLoading, setActiveLoading]         = useState(false);
  const [deliveringOrderId, setDeliveringOrderId] = useState<number | null>(null);

  // ── All deliveries calendar ───────────────────────────────────────────────
  const [drvSelectedDate, setDrvSelectedDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [drvWeekOffset, setDrvWeekOffset]     = useState(0);
  const [allDeliveries, setAllDeliveries]     = useState<AllDeliveryRow[]>([]);
  const [allDeliveriesLoading, setAllDeliveriesLoading] = useState(false);
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());

  // ── Pickup time filter ────────────────────────────────────────────────────
  const [pickupFromHour, setPickupFromHour] = useState("00");
  const [pickupToHour,   setPickupToHour]   = useState("23");
  const [pickupFromMin,  setPickupFromMin]  = useState("00");
  const [pickupToMin,    setPickupToMin]    = useState("59");

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [chatOrder, setChatOrder]     = useState<Order | null>(null);
  const [chatMsgs, setChatMsgs]       = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [unreadByOrder, setUnreadByOrder] = useState<Record<number, number>>({});
  const chatPollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Fetch orders ──────────────────────────────────────────────────────────
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

  // ── Effects ───────────────────────────────────────────────────────────────
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

  // ── UI helpers ────────────────────────────────────────────────────────────
  const toggleCard   = (id: number) => setExpandedCards(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelect = (id: number) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalUnread   = Object.values(unreadByOrder).reduce((s, n) => s + n, 0);
  const pendingCount  = orders.filter(o => o.status === "pending").length;
  const pickupOrders  = orders.filter(o => o.notes?.includes("استلام من الفرع"));
  const pickupPending = pickupOrders.filter(o => !["done","cancelled"].includes(o.status)).length;

  const visibleOrders = (() => {
    let result = filter === "all"
      ? orders.filter(o => !["done","cancelled"].includes(o.status))
      : orders.filter(o => o.status === filter);
    if (searchTerm.trim()) {
      const q = searchTerm.trim();
      result = result.filter(o =>
        o.customerName.includes(q) ||
        o.customerPhone.includes(q) ||
        String(o.dailyNumber ?? o.id).includes(q)
      );
    }
    return [...result].sort((a, b) =>
      sortNewest
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  })();

  const tabDef = [
    { key: "orders"  as CashierView, label: "استقبال الطلبات", icon: <ClipboardList size={18}/>, badge: pendingCount },
    { key: "pickup"  as CashierView, label: "تسليم الفرع",     icon: <Package size={18}/>,       badge: pickupPending },
    { key: "drivers" as CashierView, label: "المناديب",         icon: <Truck size={18}/>,         badge: activeAssignments.length },
  ];

  // ─── ORDER CARD ────────────────────────────────────────────────────────────
  function OrderCard({ order }: { order: Order }) {
    const isExpanded = expandedCards.has(order.id);
    const isSelected = selectedIds.has(order.id);
    const isPickup   = !!order.notes?.includes("استلام من الفرع");
    const isDelivery = !isPickup && (!!order.customerAddress || !!order.notes?.includes("توصيل"));
    const aRow       = assignments[order.id];
    const hasAssigned = order.status === "ready" && aRow?.status === "assigned";
    const driverPickedUp = aRow?.status === "picked_up";
    const isGPS    = order.customerAddress?.startsWith("https://");
    const time     = new Date(order.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    const unread   = unreadByOrder[order.id] ?? 0;
    const nextStatus = STATUS_NEXT[order.status];
    const nextLabel  = STATUS_NEXT_LABEL[order.status];
    const cardColor  = STATUS_CARD_COLOR[order.status];
    const cardDim    = STATUS_CARD_DIM[order.status];

    return (
      <div style={{
        background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden",
        borderInlineStart: `3px solid ${cardColor}`,
        opacity: order.status === "cancelled" ? 0.6 : 1,
      }}>
        {/* ── Head ── */}
        <div
          onClick={() => selectMode ? toggleSelect(order.id) : toggleCard(order.id)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", cursor: "pointer", gap: 10 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {selectMode && (
              <div style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isSelected ? SAFFRON : SURFACE2, border: `1.5px solid ${isSelected ? SAFFRON : LINE}` }}>
                {isSelected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1B1206" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>}
              </div>
            )}
            <span style={{ color: TEXT_FAINT, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>#{order.dailyNumber ?? order.id}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{order.customerName}</div>
              <div style={{ fontSize: 11.5, color: TEXT_FAINT, marginTop: 1 }}>{order.customerPhone} · {time}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ fontFamily: "Cairo, sans-serif", fontWeight: 700, fontSize: 15, color: TEXT }}>
              {fmt2(order.totalPrice / 100)} <span style={{ fontSize: 11, color: TEXT_FAINT, fontWeight: 500 }}>ر.س</span>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 8, background: cardDim, color: cardColor, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: cardColor, display: "inline-block", flexShrink: 0 }} />
              {STATUS_DISPLAY[order.status]}
            </div>
            {!selectMode && (
              <ChevronDown size={16} style={{ color: TEXT_FAINT, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
            )}
          </div>
        </div>

        {/* Driver chip (collapsed) */}
        {aRow && !isExpanded && (
          <div style={{ padding: "0 14px 10px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: CLR_DELIVERING_DIM, color: "#A6CDFB", fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 8 }}>
              <User size={12} />
              المندوب: {aRow.driverName}
            </div>
          </div>
        )}

        {/* ── Expanded body ── */}
        {isExpanded && (
          <div style={{ borderTop: `1px solid ${LINE}` }}>
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ height: 1, background: LINE, margin: "12px 0" }} />

              <ProgressRail status={order.status} />

              {/* Items box */}
              <div style={{ background: SURFACE2, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                {order.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                    <span style={{ color: TEXT_FAINT }}>{fmt2(item.price * item.quantity / 100)} ر.س</span>
                    <span style={{ color: TEXT }}>{item.name} × {item.quantity}</span>
                  </div>
                ))}
                {order.discountCode && order.discountAmount != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", borderTop: `1px solid ${LINE}`, marginTop: 6 }}>
                    <span style={{ color: CLR_CANCELLED }}>- {fmt2(order.discountAmount / 100)} ر.س</span>
                    <span style={{ color: CLR_CANCELLED }}>🏷️ {order.discountCode}</span>
                  </div>
                )}
              </div>

              {/* Info rows */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: TEXT_DIM, padding: "6px 0" }}>
                <span style={{ color: TEXT_FAINT }}>طريقة الدفع</span>
                <span>{order.paymentMethod === "cash" ? "💵 نقدي" : "💳 إلكتروني"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: TEXT_DIM, padding: "6px 0" }}>
                <span style={{ color: TEXT_FAINT }}>رقم الجوال</span>
                <span dir="ltr">{order.customerPhone}</span>
              </div>
              {order.customerAddress && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: TEXT_DIM, padding: "6px 0" }}>
                  <span style={{ color: TEXT_FAINT }}>العنوان</span>
                  {isGPS ? (
                    <a href={order.customerAddress} target="_blank" rel="noreferrer" style={{ color: CLR_READY, textDecoration: "none" }}>📍 موقع على الخريطة</a>
                  ) : (
                    <span>{order.customerAddress}</span>
                  )}
                </div>
              )}
              {order.notes && (
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", fontSize: 13, color: TEXT_DIM, padding: "6px 0", gap: 8 }}>
                  <span style={{ color: TEXT_FAINT, flexShrink: 0 }}>ملاحظة</span>
                  <span style={{ textAlign: "right" }}>{order.notes}</span>
                </div>
              )}

              {/* Driver chip (expanded) */}
              {aRow && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: CLR_DELIVERING_DIM, color: "#A6CDFB", fontSize: 11.5, fontWeight: 600, padding: "8px 10px", borderRadius: 8, marginTop: 10 }}>
                  <User size={12} />
                  المندوب: {aRow.driverName}
                  {driverPickedUp && <span style={{ fontSize: 11, opacity: 0.8 }}>— في الطريق</span>}
                  {!driverPickedUp && aRow.status === "assigned" && <span style={{ fontSize: 11, opacity: 0.8 }}>— بانتظار الاستلام</span>}
                </div>
              )}

              {/* ── Status advancement ── */}
              {(nextStatus || (order.status === "ready")) && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {nextStatus && nextLabel && (
                    <button
                      onClick={() => handleUpdateStatus(order, nextStatus)}
                      style={{ background: STATUS_CARD_COLOR[nextStatus] + "22", border: `1px solid ${STATUS_CARD_COLOR[nextStatus]}55`, borderRadius: 10, padding: "11px", color: STATUS_CARD_COLOR[nextStatus], fontWeight: 700, fontSize: 13.5, cursor: "pointer", width: "100%", fontFamily: "inherit" }}
                    >
                      {nextLabel}
                    </button>
                  )}
                  {order.status === "ready" && isPickup && (
                    <button
                      onClick={() => handleUpdateStatus(order, "done")}
                      style={{ background: CLR_DELIVERING_DIM, border: `1px solid ${CLR_DELIVERING}55`, borderRadius: 10, padding: "11px", color: "#A6CDFB", fontWeight: 700, fontSize: 13.5, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
                    >
                      🏪 تم تسليم الطلب للعميل
                    </button>
                  )}
                  {order.status === "ready" && isDelivery && !driverPickedUp && (
                    <>
                      <button
                        onClick={hasAssigned ? () => handleUpdateStatus(order, "done") : undefined}
                        disabled={!hasAssigned}
                        style={{ background: hasAssigned ? "rgba(61,214,140,.12)" : SURFACE2, border: `1.5px solid ${hasAssigned ? CLR_READY : LINE}`, borderRadius: 10, padding: "11px", color: hasAssigned ? CLR_READY : TEXT_FAINT, fontWeight: 700, fontSize: 13.5, cursor: hasAssigned ? "pointer" : "default", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
                      >
                        <span>🛵</span>
                        <div style={{ textAlign: "center" }}>
                          <div>تسليم الطلب للمندوب</div>
                          {!hasAssigned && <div style={{ fontSize: 11, color: TEXT_FAINT, fontWeight: 400 }}>عيّن مندوباً أولاً 🔒</div>}
                        </div>
                      </button>
                      {aRow ? (
                        <div style={{ background: "rgba(61,214,140,.06)", borderRadius: 10, padding: "10px 12px", border: `1px solid ${CLR_READY}33`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <button onClick={() => unassignDriver(order.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                            <X size={14} style={{ color: TEXT_DIM }} />
                          </button>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div>
                              <div style={{ color: CLR_READY, fontWeight: 700, fontSize: 13 }}>{aRow.driverName}</div>
                              <div style={{ color: `${CLR_READY}AA`, fontSize: 11 }}>معيّن — بانتظار التسليم</div>
                            </div>
                            <span style={{ fontSize: 16 }}>🛵</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAssigningOrderId(order.id)}
                          style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px", color: CLR_READY, fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
                        >
                          ➕ تعيين مندوب
                        </button>
                      )}
                      {assigningOrderId === order.id && (
                        <div style={{ background: "#0A1208", borderRadius: 12, padding: 14, border: `1px solid ${CLR_READY}44`, display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <button onClick={() => setAssigningOrderId(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                              <X size={16} style={{ color: TEXT_DIM }} />
                            </button>
                            <span style={{ color: CLR_READY, fontWeight: 700, fontSize: 13 }}>اختر مندوباً</span>
                          </div>
                          {drivers.length === 0 ? (
                            <p style={{ color: TEXT_FAINT, fontSize: 12, textAlign: "center" }}>لا يوجد مناديب نشطون</p>
                          ) : drivers.map(d => (
                            <button key={d.id} onClick={() => assignDriver(order.id, d.id)} style={{ background: SURFACE2, borderRadius: 10, padding: "10px 12px", border: `1px solid ${LINE}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", fontFamily: "inherit" }}>
                              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1A2A1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛵</div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>{d.name}</div>
                                <div style={{ color: TEXT_FAINT, fontSize: 11 }}>{d.phone}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Action buttons: مراسلة / طباعة / إلغاء ── */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => openChat(order)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: SAFFRON_DIM, border: "1px solid rgba(242,153,74,.35)", color: "#FFC98F", borderRadius: 10, padding: 10, fontSize: 12.5, fontFamily: "inherit", fontWeight: 500, cursor: "pointer", position: "relative" }}
                >
                  <MessageCircle size={15} />
                  مراسلة
                  {unread > 0 && (
                    <span style={{ position: "absolute", top: 3, right: 3, backgroundColor: CLR_CANCELLED, borderRadius: "50%", minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 800 }}>{unread}</span>
                  )}
                </button>
                <button
                  onClick={() => printReceipt(order)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: SURFACE2, border: `1px solid ${LINE}`, color: TEXT_DIM, borderRadius: 10, padding: 10, fontSize: 12.5, fontFamily: "inherit", fontWeight: 500, cursor: "pointer" }}
                >
                  <Printer size={15} />
                  طباعة
                </button>
                {!["done","cancelled"].includes(order.status) && !driverPickedUp && (
                  <button
                    onClick={() => handleCancelOrder(order)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: SURFACE2, border: `1px solid ${LINE}`, color: "#F7A9A9", borderRadius: 10, padding: 10, fontSize: 12.5, fontFamily: "inherit", fontWeight: 500, cursor: "pointer" }}
                  >
                    <X size={15} />
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── PICKUP VIEW ──────────────────────────────────────────────────────────
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: TEXT, fontWeight: 800, fontSize: 18 }}>🏪 تسليم من الفرع</div>
            <div style={{ color: TEXT_FAINT, fontSize: 12, marginTop: 2 }}>
              {new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <div style={{ backgroundColor: CLR_DELIVERING_DIM, borderRadius: 14, padding: "8px 16px", border: `1px solid ${CLR_DELIVERING}44`, textAlign: "center" }}>
            <div style={{ color: "#A6CDFB", fontWeight: 800, fontSize: 22 }}>{todayPending}</div>
            <div style={{ color: "#A6CDFB", fontSize: 10, fontWeight: 600 }}>بانتظار</div>
          </div>
        </div>

        <div style={{ backgroundColor: SURFACE, borderRadius: 16, border: `1px solid ${SAFFRON}44`, overflow: "hidden" }}>
          <div style={{ backgroundColor: SAFFRON + "11", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={15} style={{ color: SAFFRON }} />
            <span style={{ color: SAFFRON, fontWeight: 700, fontSize: 14 }}>إجمالي المبيعات اليوم</span>
          </div>
          <div style={{ display: "flex", padding: 14, gap: 10 }}>
            {[
              { value: todayTotal.toFixed(2), label: "ر.س إجمالي", color: CLR_READY },
              { value: String(todayDone.length), label: "طلب مكتمل", color: "#A6CDFB" },
              { value: String(todayPending), label: "بانتظار", color: SAFFRON },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, backgroundColor: s.color + "11", borderRadius: 14, padding: 14, border: `1px solid ${s.color}33`, textAlign: "center" }}>
                <div style={{ color: s.color, fontWeight: 800, fontSize: 22 }}>{s.value}</div>
                <div style={{ color: s.color, fontWeight: 600, fontSize: 12 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: SURFACE, borderRadius: 16, padding: 14, border: `1px solid ${CLR_DELIVERING}33`, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={15} style={{ color: "#A6CDFB" }} />
            <span style={{ color: "#A6CDFB", fontWeight: 700, fontSize: 14 }}>تصفية بالوقت</span>
          </div>
          {(["من","إلى"] as const).map((lbl, idx) => {
            const [h, setH] = idx === 0 ? [pickupFromHour, setPickupFromHour] : [pickupToHour, setPickupToHour];
            const [m, setM] = idx === 0 ? [pickupFromMin, setPickupFromMin] : [pickupToMin, setPickupToMin];
            return (
              <div key={lbl} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ color: TEXT_DIM, fontWeight: 600, fontSize: 12, textAlign: "right" }}>{lbl} الساعة</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, direction: "rtl" }}>
                  <input value={h} onChange={e => setH(e.target.value.replace(/\D/g,"").slice(0,2))} maxLength={2} placeholder={idx === 0 ? "00" : "23"} style={{ flex: 1, backgroundColor: SURFACE2, borderRadius: 12, border: `1px solid ${CLR_DELIVERING}44`, color: "#A6CDFB", fontWeight: 800, fontSize: 22, textAlign: "center", padding: "10px 0", outline: "none" }} />
                  <span style={{ color: TEXT_DIM, fontWeight: 800, fontSize: 20 }}>:</span>
                  <input value={m} onChange={e => setM(e.target.value.replace(/\D/g,"").slice(0,2))} maxLength={2} placeholder={idx === 0 ? "00" : "59"} style={{ flex: 1, backgroundColor: SURFACE2, borderRadius: 12, border: `1px solid ${CLR_DELIVERING}44`, color: "#A6CDFB", fontWeight: 800, fontSize: 22, textAlign: "center", padding: "10px 0", outline: "none" }} />
                </div>
                {idx === 0 && <div style={{ textAlign: "center" }}><ArrowDown size={18} style={{ color: TEXT_DIM }} /></div>}
              </div>
            );
          })}
          {(doneFiltered.length > 0 || activeFiltered.length > 0) && (
            <div style={{ backgroundColor: CLR_DELIVERING_DIM, borderRadius: 12, padding: 10, display: "flex", justifyContent: "space-around", border: `1px solid ${CLR_DELIVERING}22` }}>
              {[{ value: filteredTotal.toFixed(2), label: "ر.س في النطاق", color: "#A6CDFB" }, { value: String(doneFiltered.length), label: "مكتمل", color: CLR_READY }, { value: String(activeFiltered.length), label: "بانتظار", color: SAFFRON }].map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ color: s.color, fontWeight: 800, fontSize: 16 }}>{s.value}</div>
                  <div style={{ color: TEXT_FAINT, fontSize: 10, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {activeFiltered.length === 0 ? (
          <div style={{ backgroundColor: SURFACE, borderRadius: 16, padding: 28, textAlign: "center", border: `1px solid ${LINE}` }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🏪</div>
            <div style={{ color: TEXT_DIM, fontWeight: 600, fontSize: 14 }}>لا يوجد طلبات استلام في هذا النطاق</div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#A6CDFB" }} />
              <span style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>بانتظار الاستلام ({activeFiltered.length})</span>
            </div>
            {activeFiltered.map(order => {
              const d = new Date(order.createdAt);
              const timeStr = d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
              const dateStr = d.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
              return (
                <div key={order.id} style={{ backgroundColor: SURFACE, borderRadius: 16, border: `1px solid ${CLR_DELIVERING}44`, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ backgroundColor: CLR_DELIVERING_DIM, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ backgroundColor: CLR_DELIVERING_DIM, padding: "3px 8px", borderRadius: 8, color: "#A6CDFB", fontWeight: 800, fontSize: 14 }}>#{order.dailyNumber ?? order.id}</span>
                      <span style={{ color: TEXT, fontWeight: 700, fontSize: 15 }}>{order.customerName}</span>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ color: "#A6CDFB", fontWeight: 800, fontSize: 16 }}>{sar(order.totalPrice)}</div>
                      <span style={{ backgroundColor: STATUS_COLOR[order.status] + "22", padding: "2px 7px", borderRadius: 8, color: STATUS_COLOR[order.status], fontSize: 11, fontWeight: 700 }}>{STATUS_LABEL[order.status]}</span>
                    </div>
                  </div>
                  <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 3 }}>
                    {order.items.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: TEXT_DIM, fontSize: 12 }}>{sarRaw(item.price * item.quantity)}</span>
                        <span style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>× {item.quantity}  {item.name}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "0 14px 8px", display: "flex", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Calendar size={13} style={{ color: TEXT_DIM }} />
                      <span style={{ color: TEXT_DIM, fontSize: 12 }}>{dateStr}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={13} style={{ color: TEXT_DIM }} />
                      <span style={{ color: TEXT_DIM, fontSize: 12 }}>{timeStr}</span>
                    </div>
                  </div>
                  {order.customerPhone && (
                    <a href={`tel:${order.customerPhone}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px 10px", textDecoration: "none" }}>
                      <Phone size={13} style={{ color: "#A6CDFB" }} />
                      <span style={{ color: "#A6CDFB", fontWeight: 600, fontSize: 13 }}>{order.customerPhone}</span>
                    </a>
                  )}
                  <div style={{ display: "flex", borderTop: `1px solid ${CLR_DELIVERING}22` }}>
                    <button onClick={() => printReceipt(order)} style={{ flex: 1, backgroundColor: SURFACE2, border: "none", borderRight: `1px solid ${CLR_DELIVERING}22`, padding: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: SAFFRON, fontWeight: 700, fontSize: 13 }}>
                      <Printer size={15} style={{ color: SAFFRON }} /> طباعة
                    </button>
                    <button onClick={() => handleUpdateStatus(order, "done")} style={{ flex: 1, backgroundColor: CLR_READY_DIM, border: "none", padding: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: CLR_READY, fontWeight: 800, fontSize: 13 }}>
                      <CheckCircle size={15} style={{ color: CLR_READY }} /> ✅ تم التسليم
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {doneFiltered.length > 0 && (
          <div>
            <div style={{ height: 1, backgroundColor: LINE, margin: "4px 0 8px" }} />
            <div style={{ color: TEXT_DIM, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>✅ تم استلامها ({doneFiltered.length})</div>
            {doneFiltered.map(order => {
              const d = new Date(order.createdAt);
              const timeStr = d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
              return (
                <div key={order.id} style={{ backgroundColor: SURFACE, borderRadius: 14, border: `1px solid ${CLR_READY}33`, overflow: "hidden", opacity: 0.85, marginBottom: 6 }}>
                  <div style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: CLR_READY, fontWeight: 700, fontSize: 14 }}>{sar(order.totalPrice)}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>{order.customerName}</span>
                        <span style={{ color: CLR_READY, fontWeight: 800, fontSize: 13 }}>#{order.dailyNumber ?? order.id}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                      <Clock size={12} style={{ color: TEXT_DIM }} />
                      <span style={{ color: TEXT_DIM, fontSize: 11 }}>{timeStr}</span>
                    </div>
                  </div>
                  <button onClick={() => printReceipt(order)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: SURFACE2, border: "none", borderTop: `1px solid ${CLR_READY}22`, padding: "9px", cursor: "pointer", width: "100%", color: SAFFRON, fontWeight: 700, fontSize: 12 }}>
                    <Printer size={13} style={{ color: SAFFRON }} /> إعادة طباعة الفاتورة
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

    const assignedOrders = orders.filter(o => {
      const a = assignments[o.id];
      return a && a.status === "assigned";
    });
    const pendingByDriver = new Map<string, { driverName: string; rows: Order[] }>();
    for (const o of assignedOrders) {
      const a = assignments[o.id];
      const key = a.driverName;
      if (!pendingByDriver.has(key)) pendingByDriver.set(key, { driverName: a.driverName, rows: [] });
      pendingByDriver.get(key)!.rows.push(o);
    }

    const driverMap = new Map<string, AllDeliveryRow[]>();
    for (const r of allDeliveries) {
      const key = r.driverName || "غير محدد";
      if (!driverMap.has(key)) driverMap.set(key, []);
      driverMap.get(key)!.push(r);
    }

    return (
      <div dir="rtl">
        <div style={{ backgroundColor: SURFACE, borderBottom: `1px solid ${LINE}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 10px 6px" }}>
            <button onClick={() => setDrvWeekOffset(p => p + 1)} disabled={drvWeekOffset >= 0} style={{ background: "none", border: "none", cursor: drvWeekOffset >= 0 ? "default" : "pointer", opacity: drvWeekOffset >= 0 ? 0.25 : 1, padding: 6 }}>
              <ChevronRight size={18} style={{ color: TEXT_DIM }} />
            </button>
            <span style={{ color: TEXT, fontWeight: 800, fontSize: 14 }}>{monthLabel}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => { setDrvWeekOffset(0); const d = new Date(); d.setHours(0,0,0,0); setDrvSelectedDate(d); loadAllDeliveries(d); setExpandedDrivers(new Set()); }} style={{ backgroundColor: CLR_READY_DIM, borderRadius: 8, padding: "4px 10px", border: `1px solid ${CLR_READY}44`, cursor: "pointer", color: CLR_READY, fontWeight: 700, fontSize: 11 }}>اليوم</button>
              <button onClick={() => setDrvWeekOffset(p => p - 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                <ChevronLeft size={18} style={{ color: TEXT_DIM }} />
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "row-reverse", padding: "0 8px" }}>
            {weekDays.map((_, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <span style={{ color: TEXT_DIM, fontWeight: 600, fontSize: 10 }}>{DAY_ABBR[i]}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "row-reverse", padding: "2px 6px 8px" }}>
            {weekDays.map((d, i) => {
              const sel = isSelected(d), tod = isToday(d), fut = isFuture(d);
              return (
                <button key={i} disabled={fut} onClick={() => { setDrvSelectedDate(d); loadAllDeliveries(d); setExpandedDrivers(new Set()); }} style={{ flex: 1, display: "flex", justifyContent: "center", padding: "3px 0", background: "none", border: "none", cursor: fut ? "default" : "pointer" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: sel ? CLR_READY : tod ? CLR_READY_DIM : "transparent", border: tod && !sel ? `1px solid ${CLR_READY}66` : "none" }}>
                    <span style={{ color: sel ? "#fff" : fut ? LINE : tod ? CLR_READY : TEXT, fontWeight: sel ? 800 : 600, fontSize: 13 }}>{d.getDate()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "row-reverse", backgroundColor: BG, borderBottom: `1px solid ${LINE}`, padding: "14px 0" }}>
          {[
            { icon: "🛒", label: "تم جمعها",       value: `${totalCollected.toFixed(2)} ر.س`, color: CLR_READY },
            { icon: "📦", label: "عمليات التوصيل", value: String(allDeliveries.length),       color: SAFFRON },
            { icon: "💵", label: "نقدي",             value: `${cashCollected.toFixed(2)} ر.س`,  color: "#81C784" },
            { icon: "🚗", label: "في الطريق",        value: String(activeAssignments.length),  color: "#A6CDFB" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", borderRight: i < 3 ? `1px solid ${LINE}` : "none" }}>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
              <div style={{ color: s.color, fontWeight: 800, fontSize: 14 }}>{s.value}</div>
              <div style={{ color: TEXT_FAINT, fontSize: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Assigned orders (pending pickup) */}
          {pendingByDriver.size > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: SAFFRON }} />
                <span style={{ color: SAFFRON, fontWeight: 700, fontSize: 13 }}>⏳ طلبات معيّنة على مناديب ({assignedOrders.length})</span>
                <div style={{ flex: 1 }} />
                <button onClick={fetchAssignments} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <RefreshCw size={12} style={{ color: SAFFRON }} />
                </button>
              </div>
              {Array.from(pendingByDriver.values()).map(({ driverName, rows }) => (
                <div key={driverName} style={{ backgroundColor: "#120D00", borderRadius: 14, border: `1px solid ${SAFFRON}44`, overflow: "hidden" }}>
                  <div style={{ backgroundColor: SAFFRON + "11", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ backgroundColor: SAFFRON + "22", borderRadius: 20, padding: "3px 12px", color: SAFFRON, fontSize: 11, fontWeight: 700 }}>{rows.length} طلب</span>
                    <span style={{ color: SAFFRON, fontWeight: 800, fontSize: 15 }}>🛵 {driverName}</span>
                  </div>
                  {rows.map((o, i) => {
                    const time = new Date(o.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
                    const isPickup = !!o.notes?.includes("استلام من الفرع");
                    return (
                      <div key={o.id} style={{ padding: "10px 14px", borderTop: i > 0 ? `1px solid ${LINE}` : undefined, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: TEXT_DIM, fontSize: 12 }}>{time}</span>
                            <span style={{ color: STATUS_CARD_COLOR[o.status], fontSize: 11, fontWeight: 700, backgroundColor: STATUS_CARD_DIM[o.status], padding: "2px 7px", borderRadius: 6 }}>{STATUS_DISPLAY[o.status]}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: SAFFRON, fontWeight: 800, fontSize: 14 }}>{sar(o.totalPrice)}</span>
                            <span style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>{o.customerName}</span>
                            <span style={{ backgroundColor: SAFFRON + "22", padding: "2px 7px", borderRadius: 7, color: SAFFRON, fontWeight: 800, fontSize: 12 }}>#{o.dailyNumber ?? o.id}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {o.items.map((item, ii) => (
                            <div key={ii} style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: TEXT_DIM, fontSize: 11 }}>{sarRaw(item.price * item.quantity)}</span>
                              <span style={{ color: TEXT, fontSize: 12 }}>{item.name} × {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                        {o.customerAddress && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                            <span style={{ color: TEXT_DIM, fontSize: 11 }}>
                              {o.customerAddress.startsWith("https://") ? "📍 موقع GPS" : o.customerAddress}
                            </span>
                            <MapPin size={11} style={{ color: TEXT_DIM }} />
                          </div>
                        )}
                        {!isPickup && (
                          <button
                            onClick={() => handleUpdateStatus(o, "done")}
                            style={{ backgroundColor: CLR_READY_DIM, border: `1px solid ${CLR_READY}66`, borderRadius: 10, padding: "9px", color: CLR_READY, fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}
                          >
                            <span>🛵</span> تسليم الطلب للمندوب
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Active in-transit */}
          {activeAssignments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: CLR_READY }} />
                <span style={{ color: CLR_READY, fontWeight: 700, fontSize: 13 }}>🚗 بانتظار التسليم ({activeAssignments.length})</span>
                <div style={{ flex: 1 }} />
                <button onClick={loadActiveAssignments} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <RefreshCw size={12} style={{ color: CLR_READY }} />
                </button>
              </div>
              {activeAssignments.map(a => {
                const gpsLost = !a.locationUpdatedAt || (Date.now() - new Date(a.locationUpdatedAt).getTime() > 30000);
                return (
                  <div key={a.orderId} style={{ backgroundColor: "#0A120A", borderRadius: 14, border: `1px solid ${gpsLost ? SAFFRON + "44" : CLR_READY + "44"}`, overflow: "hidden" }}>
                    {gpsLost && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: SAFFRON + "18", padding: "6px 12px", borderBottom: `1px solid ${SAFFRON}33` }}>
                        <span style={{ fontSize: 13 }}>⚠️</span>
                        <span style={{ color: SAFFRON, fontWeight: 700, fontSize: 12 }}>انقطع إشارة GPS للمندوب</span>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", padding: 12, gap: 10 }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                          <span style={{ backgroundColor: SAFFRON + "22", padding: "2px 7px", borderRadius: 7, color: SAFFRON, fontWeight: 800, fontSize: 12 }}>#{a.dailyNumber ?? a.orderId}</span>
                          <span style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>{a.customerName}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: "row-reverse" }}>
                          <span style={{ color: CLR_READY, fontWeight: 700, fontSize: 14 }}>{sar(a.totalPrice)}</span>
                          <span style={{ color: a.paymentMethod === "cash" ? "#81C784" : "#A6CDFB", fontSize: 12, fontWeight: 600 }}>{a.paymentMethod === "cash" ? "💵 نقدي" : "💳 إلكتروني"}</span>
                        </div>
                        {a.customerAddress && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, flexDirection: "row-reverse" }}>
                            <MapPin size={12} style={{ color: TEXT_DIM }} />
                            {a.customerAddress.startsWith("https://") ? (
                              <a href={a.customerAddress} target="_blank" rel="noreferrer" style={{ color: CLR_READY, fontSize: 12, textDecoration: "none" }}>📍 موقع على الخريطة</a>
                            ) : (
                              <span style={{ color: TEXT_DIM, fontSize: 12 }}>{a.customerAddress}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: CLR_READY_DIM, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🛵</div>
                        <span style={{ color: CLR_READY, fontWeight: 700, fontSize: 12, textAlign: "center" }}>{a.driverName}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", borderTop: `1px solid ${CLR_READY}22` }}>
                      <a href={`tel:${a.driverPhone}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", color: "#A6CDFB", fontWeight: 700, fontSize: 12, textDecoration: "none", borderRight: `1px solid ${CLR_READY}22` }}>
                        <Phone size={14} style={{ color: "#A6CDFB" }} /> اتصل بالمندوب
                      </a>
                      <button
                        onClick={() => confirmDelivery(a.orderId)}
                        disabled={deliveringOrderId === a.orderId}
                        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", color: CLR_READY, fontWeight: 700, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}
                      >
                        <CheckCircle size={14} style={{ color: CLR_READY }} />
                        {deliveringOrderId === a.orderId ? "..." : "تأكيد التسليم"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Historical deliveries */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allDeliveriesLoading ? (
              <div style={{ textAlign: "center", padding: 20, color: TEXT_DIM }}>⏳ جارٍ التحميل...</div>
            ) : allDeliveries.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: TEXT_FAINT }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <div>لا توجد توصيلات في هذا اليوم</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#A6CDFB" }} />
                  <span style={{ color: "#A6CDFB", fontWeight: 700, fontSize: 13 }}>📋 سجل التوصيلات ({allDeliveries.length})</span>
                </div>
                {Array.from(driverMap.entries()).map(([name, rows]) => {
                  const total = rows.reduce((s, r) => s + r.totalPrice, 0);
                  const expanded = expandedDrivers.has(name);
                  return (
                    <div key={name} style={{ backgroundColor: "#0A120A", borderRadius: 14, border: `1px solid ${CLR_READY}44`, overflow: "hidden" }}>
                      <button onClick={() => setExpandedDrivers(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; })} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, background: "none", border: "none", cursor: "pointer" }}>
                        <ChevronDown size={16} style={{ color: TEXT_DIM, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: CLR_READY, fontWeight: 700, fontSize: 13 }}>{total.toFixed(2)} ر.س</div>
                            <div style={{ color: TEXT_FAINT, fontSize: 11 }}>{rows.length} توصيلة</div>
                          </div>
                          <span style={{ color: CLR_READY, fontWeight: 800, fontSize: 15 }}>🛵 {name}</span>
                        </div>
                      </button>
                      {expanded && (
                        <div style={{ borderTop: `1px solid ${CLR_READY}33` }}>
                          {rows.map((r, i) => (
                            <div key={i} style={{ padding: "10px 14px", borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ color: TEXT_DIM, fontSize: 11 }}>{fmtTime(r.deliveredAt)}</span>
                                <span style={{ color: r.paymentMethod === "cash" ? "#81C784" : "#A6CDFB", fontSize: 12, fontWeight: 600 }}>{r.paymentMethod === "cash" ? "💵" : "💳"}</span>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>{r.customerName}</div>
                                <div style={{ color: CLR_READY, fontWeight: 800, fontSize: 14 }}>{r.totalPrice.toFixed(2)} ر.س</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" style={{ background: BG, minHeight: "100vh", fontFamily: "'IBM Plex Sans Arabic', 'Cairo', sans-serif" }}>

      {/* ── App bar (sticky) ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: `linear-gradient(180deg, ${BG} 85%, rgba(20,22,27,0))`, padding: "18px 20px 10px" }}>

        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #F2994A, #C9761E)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cairo, sans-serif", fontWeight: 800, color: "#1B1206", fontSize: 16, flexShrink: 0 }}>ر</div>
            <div>
              <div style={{ fontFamily: "Cairo, sans-serif", fontWeight: 700, fontSize: 15.5, color: TEXT }}>روابي المندي</div>
              <div style={{ fontSize: 11.5, color: TEXT_FAINT, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: CLR_READY, display: "inline-block", flexShrink: 0, boxShadow: `0 0 0 3px ${CLR_READY_DIM}` }} className={cn(fetching && "animate-ping")} />
                تحديث تلقائي كل 10 ثوانٍ
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {hasNewOrder && (
              <div className="animate-bounce" style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: CLR_CANCELLED, color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 9999 }}>
                <Bell size={11} /> طلب جديد!
              </div>
            )}
            <button
              onClick={() => fetchOrders()}
              disabled={fetching}
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${LINE}`, background: SURFACE, color: TEXT_DIM, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <RefreshCw size={16} className={cn(fetching && "animate-spin")} />
            </button>
          </div>
        </div>

        <h1 style={{ fontSize: 24, fontFamily: "Cairo, sans-serif", fontWeight: 800, margin: "10px 0 14px", color: TEXT }}>إدارة الطلبات</h1>

        {/* Search (orders tab only) */}
        {cashierView === "orders" && (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEXT_FAINT} strokeWidth="2" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم الطلب أو اسم العميل أو الجوال"
              style={{ width: "100%", background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 40px 12px 14px", color: TEXT, fontFamily: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        )}

        {/* Filter tabs (orders tab only) */}
        {cashierView === "orders" && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none", marginBottom: 4 }}>
            {ORDER_FILTERS.map(f => {
              const cnt = f.key === "all"
                ? orders.filter(o => !["done","cancelled"].includes(o.status)).length
                : orders.filter(o => o.status === f.key).length;
              const active = filter === f.key;
              return (
                <div
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: active ? SAFFRON_DIM : SURFACE, border: `1px solid ${active ? "rgba(242,153,74,.4)" : LINE}`, color: active ? "#FFC98F" : TEXT_DIM, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {f.label}
                  {cnt > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: active ? SAFFRON : "#2C303B", color: active ? "#1B1206" : TEXT_DIM }}>{cnt}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sort + select row (orders tab only) */}
        {cashierView === "orders" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0" }}>
            <div
              onClick={() => setSortNewest(p => !p)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: SURFACE, border: `1px solid ${LINE}`, color: TEXT_DIM, fontFamily: "inherit", fontSize: 12.5, padding: "7px 12px", borderRadius: 9, cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5h10M11 9h7M11 13h4"/><path d="m3 8 3-3 3 3M6 5v14"/></svg>
              {sortNewest ? "الأحدث أولاً" : "الأقدم أولاً"}
            </div>
            <div
              onClick={() => { setSelectMode(p => !p); if (selectMode) setSelectedIds(new Set()); }}
              style={{ display: "flex", alignItems: "center", gap: 6, color: selectMode ? SAFFRON : TEXT_FAINT, fontSize: 12.5, cursor: "pointer", userSelect: "none" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              تحديد للطباعة
            </div>
          </div>
        )}

        {/* Section nav (3 tabs) */}
        <div style={{ display: "flex", gap: 6, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: 4, margin: "12px 0 4px" }}>
          {tabDef.map(tab => {
            const active = cashierView === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setCashierView(tab.key); if (tab.key === "drivers") { loadActiveAssignments(); loadAllDeliveries(drvSelectedDate); } }}
                style={{ flex: 1, background: active ? SURFACE2 : "transparent", border: active ? `1px solid ${LINE}` : "none", color: active ? TEXT : TEXT_DIM, fontFamily: "inherit", padding: "9px 6px", borderRadius: 9, fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}
              >
                {tab.badge > 0 && (
                  <span style={{ position: "absolute", top: 4, right: 4, backgroundColor: CLR_CANCELLED, borderRadius: "50%", minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 800, padding: "0 2px" }}>
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
                <span style={{ color: active ? SAFFRON : TEXT_DIM }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── New-order banner ── */}
      {cashierView === "orders" && hasNewOrder && (
        <div style={{ backgroundColor: CLR_CANCELLED, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "0 20px 12px", borderRadius: 12 }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "Cairo, sans-serif" }}>طلب جديد وصل!</span>
          <span style={{ fontSize: 20 }}>🔔</span>
        </div>
      )}

      {/* ── Tab content ── */}
      {cashierView === "orders" && (
        <div style={{ padding: "0 16px 120px", display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 40 }}>⏳</div>
              <div style={{ color: TEXT_DIM, marginTop: 8 }}>جارٍ التحميل...</div>
            </div>
          ) : visibleOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT_FAINT }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4, display: "block", margin: "0 auto 12px" }}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              <div>لا توجد طلبات مطابقة</div>
            </div>
          ) : (
            visibleOrders.map(order => <OrderCard key={order.id} order={order} />)
          )}
          {!loading && (
            <p style={{ textAlign: "center", color: TEXT_FAINT, fontSize: 12, marginTop: 4 }}>
              {visibleOrders.length} طلب{filter !== "all" ? ` · من إجمالي ${orders.length}` : ""}
            </p>
          )}
        </div>
      )}
      {cashierView === "pickup"  && <PickupView />}
      {cashierView === "drivers" && <DriversView />}

      {/* ── Bulk print bar ── */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{ position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 40, background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 12px 30px rgba(0,0,0,.4)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
            تم تحديد <span style={{ color: SAFFRON, fontFamily: "Cairo, sans-serif", fontWeight: 700 }}>{selectedIds.size}</span> طلب
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setSelectedIds(new Set()); setSelectMode(false); }} style={{ background: "transparent", border: `1px solid ${LINE}`, color: TEXT_DIM, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 9, cursor: "pointer" }}>إلغاء</button>
            <button
              onClick={() => { printBulk(orders.filter(o => selectedIds.has(o.id))); setSelectedIds(new Set()); setSelectMode(false); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: SAFFRON_DIM, border: "1px solid rgba(242,153,74,.35)", color: "#FFC98F", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 9, cursor: "pointer" }}
            >
              <Printer size={14} /> طباعة المحدد
            </button>
          </div>
        </div>
      )}

      {/* ── Chat modal ── */}
      {chatOrder && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", border: `1px solid ${LINE}` }} dir="rtl">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${LINE}` }}>
              <button onClick={() => setChatOrder(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={22} style={{ color: TEXT_DIM }} />
              </button>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: TEXT }}>💬 مراسلة العميل</div>
                <div style={{ color: TEXT_DIM, fontSize: 12 }}>طلب #{chatOrder.dailyNumber ?? chatOrder.id} — {chatOrder.customerName}</div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {chatLoading ? (
                <div style={{ textAlign: "center", color: TEXT_DIM }}>⏳</div>
              ) : chatMsgs.length === 0 ? (
                <div style={{ textAlign: "center", color: TEXT_DIM, marginTop: 24 }}>لا توجد رسائل بعد</div>
              ) : chatMsgs.map(msg => (
                <div key={msg.id} style={{ display: "flex", justifyContent: msg.fromCashier ? "flex-start" : "flex-end" }}>
                  <div style={{ maxWidth: "80%", backgroundColor: msg.fromCashier ? SURFACE2 : "#1A2A1A", borderRadius: 14, padding: "10px 14px", border: msg.fromCashier ? `1px solid ${LINE}` : `1px solid ${CLR_READY}33` }}>
                    <div style={{ fontSize: 14, color: TEXT }}>{msg.text}</div>
                    <div style={{ fontSize: 10, color: TEXT_DIM, marginTop: 4, textAlign: msg.fromCashier ? "right" : "left" }}>
                      {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      {msg.fromCashier && <span style={{ marginRight: 4 }}>{msg.readAt ? "✓✓" : "✓"}</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${LINE}`, display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={sendChatMessage} disabled={chatSending || !chatInput.trim()} style={{ backgroundColor: chatInput.trim() ? CLR_READY : SURFACE2, border: "none", borderRadius: 10, padding: "10px 14px", cursor: chatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={16} style={{ color: chatInput.trim() ? "#fff" : TEXT_DIM }} />
              </button>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChatMessage()}
                placeholder="اكتب رسالة..."
                style={{ flex: 1, backgroundColor: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 14px", color: TEXT, fontSize: 14, textAlign: "right", outline: "none", fontFamily: "inherit" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Calendar({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
