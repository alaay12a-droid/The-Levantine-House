import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Bell, Phone, Clock, Truck, Store, DollarSign, Search, Check, X, Printer,
  MapPin, User, TrendingUp, Package, Calendar, ChevronLeft, Wallet,
  CircleDot, PackageCheck, UserCheck, Banknote, CreditCard, Smartphone,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Filter, Zap
} from "lucide-react";

/* ---------------------------------------------------------------
   FONT INJECTION — Tajawal (Arabic-native geometric sans)
---------------------------------------------------------------- */
function useTajawalFont() {
  useEffect(() => {
    if (document.getElementById("tajawal-font")) return;
    const link = document.createElement("link");
    link.id = "tajawal-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* ---------------------------------------------------------------
   DESIGN TOKENS
   bg base #0B0F14 · surface #131A21 · card #1A222B · border #262F39
   text primary #EDF2F6 · secondary #8B96A3 · muted #56626D
   signal: new/urgent amber #F5A623 · preparing blue #4A9EFF
   ready/success green #34D399 · danger #F6604F · scheduled violet #A78BFA
---------------------------------------------------------------- */
const C = {
  bg: "#0B0F14",
  surface: "#111820",
  card: "#1A222C",
  cardHover: "#202a35",
  border: "#262F3A",
  text: "#EDF2F6",
  sub: "#8B96A3",
  muted: "#57626D",
  amber: "#F5A623",
  blue: "#4A9EFF",
  green: "#34D399",
  red: "#F6604F",
  violet: "#A78BFA",
};

/* ---------------------------------------------------------------
   MOCK DATA
---------------------------------------------------------------- */
const NAMES = ["أحمد الشمري", "سارة العتيبي", "خالد المطيري", "منيرة الدوسري", "فيصل الحربي", "لمى القحطاني", "عبدالله الزهراني", "هند العنزي", "تركي السبيعي", "ريم الغامدي"];
const DRIVER_NAMES = ["ماجد سالم", "ناصر يوسف", "بندر عمر", "سلطان راشد", "حمد فهد"];

function randPhone() {
  return "05" + Math.floor(10000000 + Math.random() * 89999999);
}

function makeOrder(id, type, status, minsAgo) {
  const total = Math.floor(35 + Math.random() * 160);
  const fee = type === "delivery" ? 8 : 0;
  const prepTotal = 12 * 60; // seconds
  const AREAS = ["حي النزهة", "حي الملقا", "حي العليا", "حي الياسمين", "حي الروضة", "حي السليمانية"];
  const ITEMS = [
    ["برجر لحم مزدوج", 2], ["بطاطس كبيرة", 1], ["مشروب غازي", 2], ["سلطة سيزر", 1], ["كولا دايت", 1],
  ];
  return {
    id,
    number: `#${1000 + id}`,
    type, // delivery | pickup | scheduled
    status, // new | preparing | ready | onway | delivered | cancelled | arrived | waiting
    customer: NAMES[id % NAMES.length],
    phone: randPhone(),
    address: AREAS[id % AREAS.length],
    items: ITEMS.slice(0, 2 + (id % 3)),
    total,
    fee,
    payment: ["نقدي", "بطاقة", "محفظة"][id % 3],
    priority: minsAgo > 8 ? "high" : minsAgo > 4 ? "med" : "low",
    remaining: Math.max(prepTotal - minsAgo * 60, 30),
    prepTotal,
    scheduledFor: type === "scheduled" ? "٧:٣٠ م" : null,
    driver: null,
  };
}

const initialOrders = [
  makeOrder(1, "delivery", "new", 1),
  makeOrder(2, "delivery", "new", 9),
  makeOrder(3, "pickup", "waiting", 3),
  makeOrder(4, "delivery", "preparing", 5),
  makeOrder(5, "scheduled", "new", 0),
  makeOrder(6, "pickup", "waiting", 6),
  makeOrder(7, "delivery", "new", 2),
  makeOrder(8, "pickup", "ready", 10),
];

const drivers = [
  { id: 1, name: DRIVER_NAMES[0], online: true, busy: true, active: 2, completedToday: 14, earnings: 210, cashCollected: 640, balance: 430, avgTime: 22, phone: randPhone() },
  { id: 2, name: DRIVER_NAMES[1], online: true, busy: false, active: 0, completedToday: 9, earnings: 150, cashCollected: 380, balance: 380, avgTime: 19, phone: randPhone() },
  { id: 3, name: DRIVER_NAMES[2], online: false, busy: false, active: 0, completedToday: 6, earnings: 96, cashCollected: 210, balance: 0, avgTime: 27, phone: randPhone() },
  { id: 4, name: DRIVER_NAMES[3], online: true, busy: true, active: 1, completedToday: 11, earnings: 175, cashCollected: 520, balance: 520, avgTime: 21, phone: randPhone() },
  { id: 5, name: DRIVER_NAMES[4], online: true, busy: false, active: 0, completedToday: 17, earnings: 260, cashCollected: 90, balance: 90, avgTime: 18, phone: randPhone() },
];

const finance = {
  todaySales: 18420,
  deliverySales: 11200,
  pickupSales: 7220,
  cash: 9800,
  card: 6100,
  wallet: 2520,
  deliveryFees: 960,
  discounts: 540,
  refunds: 210,
  completed: 214,
  cancelled: 9,
  avgOrder: 86,
};

/* ---------------------------------------------------------------
   HELPERS
---------------------------------------------------------------- */
function fmtSecs(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function priorityColor(p) {
  return p === "high" ? C.red : p === "med" ? C.amber : C.green;
}

const statusMeta = {
  new: { label: "جديد", color: C.amber },
  preparing: { label: "قيد التحضير", color: C.blue },
  ready: { label: "جاهز", color: C.green },
  onway: { label: "في الطريق", color: C.blue },
  delivered: { label: "تم التسليم", color: C.muted },
  cancelled: { label: "ملغي", color: C.red },
  waiting: { label: "بالانتظار", color: C.amber },
  arrived: { label: "العميل وصل", color: C.violet },
};

/* ---------------------------------------------------------------
   PRIMITIVES
---------------------------------------------------------------- */
function Badge({ color, children, soft }) {
  return (
    <span
      style={{
        color: soft ? color : "#0B0F14",
        background: soft ? color + "20" : color,
        border: soft ? `1px solid ${color}55` : "none",
      }}
      className="text-[11px] font-bold px-2 py-1 rounded-md whitespace-nowrap"
    >
      {children}
    </span>
  );
}

function IconBtn({ icon: Icon, label, onClick, tone = "default", small }) {
  const tones = {
    default: { bg: C.card, fg: C.text, border: C.border },
    good: { bg: C.green + "1a", fg: C.green, border: C.green + "55" },
    bad: { bg: C.red + "1a", fg: C.red, border: C.red + "55" },
    info: { bg: C.blue + "1a", fg: C.blue, border: C.blue + "55" },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.border}` }}
      className={`flex items-center gap-1.5 ${small ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-2 text-[13px]"} rounded-lg font-bold transition-transform active:scale-95 hover:brightness-125`}
    >
      <Icon size={small ? 14 : 15} strokeWidth={2.5} />
      {label}
    </button>
  );
}

/* Countdown ring — signature element: prep-time health at a glance */
function TimerRing({ remaining, total, size = 58 }) {
  const pct = Math.max(0, Math.min(1, remaining / total));
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const color = pct > 0.5 ? C.green : pct > 0.2 ? C.amber : C.red;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={C.border} strokeWidth="4" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
        />
      </svg>
      <span className="absolute text-[11px] font-extrabold tabular-nums" style={{ color }}>
        {fmtSecs(remaining)}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------
   TOP BAR
---------------------------------------------------------------- */
function TopBar({ tab, setTab, counts, now }) {
  const tabs = [
    { id: "incoming", label: "الطلبات الواردة", icon: Bell, count: counts.incoming },
    { id: "pickup", label: "الاستلام من الفرع", icon: Store, count: counts.pickup },
    { id: "drivers", label: "مركز السائقين", icon: Truck, count: counts.driversOnline },
    { id: "finance", label: "الملخص المالي", icon: DollarSign, count: null },
  ];
  return (
    <div style={{ background: C.surface, borderColor: C.border }} className="border-b sticky top-0 z-30">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div style={{ background: C.amber }} className="w-8 h-8 rounded-lg flex items-center justify-center">
            <Zap size={18} strokeWidth={2.5} className="text-[#0B0F14]" />
          </div>
          <div>
            <div className="font-extrabold text-[15px]" style={{ color: C.text }}>مركز عمليات الطلبات</div>
            <div className="text-[11px]" style={{ color: C.muted }}>لوحة تحكم الكاشير — مباشر</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: C.green }}>
            <CircleDot size={10} className="animate-pulse" fill={C.green} />
            متصل الآن
          </div>
          <div className="text-[13px] font-bold tabular-nums" style={{ color: C.sub }}>{now}</div>
        </div>
      </div>
      <div className="flex gap-1 px-5 overflow-x-auto">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                borderColor: active ? C.amber : "transparent",
                color: active ? C.text : C.sub,
              }}
              className="relative flex items-center gap-2 px-4 py-3 border-b-2 text-[13px] font-bold transition-colors whitespace-nowrap"
            >
              <t.icon size={16} strokeWidth={2.5} />
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span
                  style={{ background: active ? C.amber : C.border, color: active ? "#0B0F14" : C.sub }}
                  className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   SECTION 1 — INCOMING ORDERS
---------------------------------------------------------------- */
function typeMeta(type) {
  if (type === "delivery") return { label: "توصيل", icon: Truck, color: C.blue };
  if (type === "pickup") return { label: "استلام", icon: Store, color: C.green };
  return { label: "مجدول", icon: Calendar, color: C.violet };
}

function DriverPicker({ order, onPick, onClose }) {
  const available = drivers.filter((d) => d.online);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#0000008a" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, borderColor: C.border }}
        className="w-full max-w-sm rounded-2xl border overflow-hidden"
      >
        <div style={{ borderColor: C.border }} className="border-b p-4 flex items-center justify-between">
          <div>
            <div className="font-extrabold text-[14px]" style={{ color: C.text }}>تعيين سائق</div>
            <div className="text-[11px]" style={{ color: C.muted }}>الطلب {order.number} — {order.customer}</div>
          </div>
          <button onClick={onClose} style={{ color: C.muted }}><X size={20} /></button>
        </div>
        <div className="p-3">
          <div className="text-[11px] font-bold px-1 pb-2" style={{ color: C.muted }}>اختر مندوبًا متصلًا</div>
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {available.map((d) => (
              <button
                key={d.id}
                onClick={() => onPick(d.name)}
                style={{ background: C.card, color: C.text }}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold hover:brightness-125 text-right"
              >
                <span className="flex items-center gap-2">
                  <span style={{ background: C.border }} className="w-8 h-8 rounded-full flex items-center justify-center text-[12px]">{d.name[0]}</span>
                  <span>
                    <span className="block">{d.name}</span>
                    <span className="block text-[10px] font-normal" style={{ color: C.muted }}>{d.active} طلب نشط · {d.avgTime} د متوسط</span>
                  </span>
                </span>
                <Badge color={d.busy ? C.amber : C.green} soft>{d.busy ? "مشغول" : "متاح"}</Badge>
              </button>
            ))}
            {available.length === 0 && <div className="text-[12px] px-2 py-6 text-center" style={{ color: C.muted }}>لا يوجد مناديب متصلون حاليًا</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose, onReject }) {
  if (!order) return null;
  const tm = typeMeta(order.type);
  const st = statusMeta[order.status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#0000008a" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, borderColor: C.border }}
        className="w-full max-w-md rounded-2xl border overflow-hidden max-h-[85vh] flex flex-col"
      >
        <div style={{ borderColor: C.border }} className="border-b p-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div style={{ background: tm.color + "20", color: tm.color }} className="w-10 h-10 rounded-xl flex items-center justify-center">
              <tm.icon size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-extrabold text-[16px] tabular-nums" style={{ color: C.text }}>{order.number}</div>
              <div className="text-[11px] font-bold" style={{ color: tm.color }}>{tm.label}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: C.muted }}><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold" style={{ color: C.muted }}>الحالة</span>
            <Badge color={st.color} soft>{st.label}{order.driver ? ` — ${order.driver}` : ""}</Badge>
          </div>

          <div style={{ background: C.card, borderColor: C.border }} className="rounded-xl border p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[13px] font-bold" style={{ color: C.text }}>
              <User size={14} style={{ color: C.muted }} /> {order.customer}
            </div>
            <div dir="ltr" className="flex items-center gap-2 text-[13px] justify-end" style={{ color: C.sub }}>
              <span>{order.phone}</span><Phone size={13} style={{ color: C.muted }} />
            </div>
            {order.type === "delivery" && (
              <div className="flex items-center gap-2 text-[13px]" style={{ color: C.sub }}>
                <MapPin size={13} style={{ color: C.muted }} /> {order.address}
              </div>
            )}
          </div>

          <div>
            <div className="text-[12px] font-extrabold mb-2" style={{ color: C.text }}>محتويات الطلب</div>
            <div className="flex flex-col gap-1.5">
              {order.items.map(([name, qty], i) => (
                <div key={i} className="flex items-center justify-between text-[12px]" style={{ color: C.sub }}>
                  <span>{name}</span>
                  <span className="font-bold" style={{ color: C.text }}>× {qty}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderColor: C.border }} className="border-t pt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[13px] font-extrabold" style={{ color: C.text }}>{order.total} ر.س</div>
              <div className="text-[10px]" style={{ color: C.muted }}>الإجمالي</div>
            </div>
            <div>
              <div className="text-[13px] font-extrabold" style={{ color: C.text }}>{order.fee || "—"}</div>
              <div className="text-[10px]" style={{ color: C.muted }}>رسوم التوصيل</div>
            </div>
            <div>
              <div className="text-[13px] font-extrabold" style={{ color: C.text }}>{order.payment}</div>
              <div className="text-[10px]" style={{ color: C.muted }}>الدفع</div>
            </div>
          </div>
        </div>

        <div style={{ borderColor: C.border }} className="border-t p-4 flex gap-2">
          <IconBtn icon={Printer} label="طباعة" tone="default" onClick={() => {}} />
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <IconBtn icon={X} label="إلغاء الطلب" tone="bad" onClick={() => { onReject(order.id); onClose(); }} />
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, onAccept, onReject, onAssign, onView }) {
  const [picking, setPicking] = useState(false);
  const tm = typeMeta(order.type);
  const st = statusMeta[order.status];
  const isNew = order.status === "new";
  const needsDriver = (order.type === "delivery" || order.type === "scheduled") && !order.driver;
  return (
    <div
      style={{
        background: C.card,
        borderColor: isNew ? priorityColor(order.priority) + "70" : C.border,
        boxShadow: isNew ? `0 0 0 1px ${priorityColor(order.priority)}25` : "none",
      }}
      className="relative rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between">
        <button className="flex items-center gap-2 text-right" onClick={() => onView(order)}>
          <div style={{ background: tm.color + "20", color: tm.color }} className="w-9 h-9 rounded-xl flex items-center justify-center">
            <tm.icon size={17} strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-extrabold text-[14px] tabular-nums" style={{ color: C.text }}>{order.number}</div>
            <div className="text-[11px] font-bold" style={{ color: tm.color }}>{tm.label}{order.scheduledFor ? ` · ${order.scheduledFor}` : ""}</div>
          </div>
        </button>
        <TimerRing remaining={order.remaining} total={order.prepTotal} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: C.text }}>
          <User size={13} style={{ color: C.muted }} /> {order.customer}
        </div>
        <Badge color={st.color} soft>{st.label}</Badge>
      </div>

      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: C.sub }}>
        <Phone size={12} /> <span dir="ltr">{order.phone}</span>
      </div>

      <div style={{ borderColor: C.border }} className="border-t pt-2.5 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[13px] font-extrabold" style={{ color: C.text }}>{order.total} ر.س</div>
          <div className="text-[10px]" style={{ color: C.muted }}>الإجمالي</div>
        </div>
        <div>
          <div className="text-[13px] font-extrabold" style={{ color: C.text }}>{order.fee || "—"}</div>
          <div className="text-[10px]" style={{ color: C.muted }}>رسوم التوصيل</div>
        </div>
        <div>
          <div className="text-[13px] font-extrabold" style={{ color: C.text }}>{order.payment}</div>
          <div className="text-[10px]" style={{ color: C.muted }}>الدفع</div>
        </div>
      </div>

      <div className="flex gap-1.5 pt-1 relative">
        {isNew ? (
          <>
            <IconBtn icon={Check} label="قبول" tone="good" onClick={() => onAccept(order.id)} />
            <IconBtn icon={X} label="رفض" tone="bad" onClick={() => onReject(order.id)} />
            <IconBtn icon={Search} label="" small tone="default" onClick={() => onView(order)} />
          </>
        ) : needsDriver ? (
          <>
            <IconBtn icon={Truck} label="تعيين سائق" tone="info" onClick={() => setPicking((p) => !p)} />
            <IconBtn icon={Printer} label="طباعة" tone="default" onClick={() => {}} />
            <IconBtn icon={Search} label="" small tone="default" onClick={() => onView(order)} />
            {picking && (
              <DriverPicker
                order={order}
                onPick={(name) => { onAssign(order.id, name); setPicking(false); }}
                onClose={() => setPicking(false)}
              />
            )}
          </>
        ) : (
          <>
            <IconBtn icon={Printer} label="طباعة" tone="default" onClick={() => {}} />
            <IconBtn icon={Search} label="التفاصيل" small tone="default" onClick={() => onView(order)} />
          </>
        )}
      </div>
    </div>
  );
}

function DriverGroupSection({ orders, onUnassign }) {
  const assigned = orders.filter((o) => o.driver && o.status !== "cancelled" && o.status !== "delivered");
  if (assigned.length === 0) return null;

  const groups = {};
  assigned.forEach((o) => {
    groups[o.driver] = groups[o.driver] || [];
    groups[o.driver].push(o);
  });

  return (
    <div className="mt-7">
      <div className="flex items-center gap-2 mb-3">
        <div style={{ background: C.border }} className="h-px flex-1" />
        <span className="text-[11px] font-extrabold flex items-center gap-1.5" style={{ color: C.muted }}>
          <Truck size={13} /> مع المناديب — خرجت من قائمة الطلبات الجديدة
        </span>
        <div style={{ background: C.border }} className="h-px flex-1" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Object.entries(groups).map(([driverName, list]) => (
          <div key={driverName} style={{ background: C.surface, borderColor: C.border }} className="rounded-2xl border p-3">
            <div className="flex items-center gap-2 mb-2.5 px-1">
              <span style={{ background: C.blue + "20", color: C.blue }} className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold">
                {driverName[0]}
              </span>
              <span className="text-[12px] font-extrabold" style={{ color: C.text }}>{driverName}</span>
              <span style={{ color: C.muted }} className="text-[11px] font-bold mr-auto">{list.length} طلب</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((o) => (
                <div key={o.id} style={{ background: C.card, borderColor: C.border }} className="rounded-lg border p-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-[12px] tabular-nums" style={{ color: C.text }}>{o.number}</div>
                    <div className="text-[11px]" style={{ color: C.sub }}>{o.customer}</div>
                  </div>
                  <button
                    onClick={() => onUnassign(o.id)}
                    style={{ color: C.amber, borderColor: C.amber + "55", background: C.amber + "15" }}
                    className="text-[10px] font-bold px-2 py-1 rounded-md border"
                  >
                    إرجاع للقائمة
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomingOrders({ orders, setOrders }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState(null);
  // Only orders still awaiting a cashier decision belong here.
  // Pickup orders that were already accepted move fully to the Pickup Branch page —
  // keeping them here too would show the same order in two places at once.
  const pool = orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "delivered" && !o.driver && !(o.type === "pickup" && o.status !== "new")
  );
  const filtered = pool
    .filter((o) => (filter === "all" ? true : o.type === filter))
    .filter((o) => !q || o.number.includes(q) || o.customer.includes(q) || o.phone.includes(q));

  const accept = (id) =>
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: o.type === "pickup" ? "waiting" : "preparing" } : o)));
  const reject = (id) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o)));
  const assign = (id, driverName) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, driver: driverName, status: "onway" } : o)));
  const unassign = (id) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, driver: null, status: "preparing" } : o)));

  const filters = [
    { id: "all", label: "الكل" },
    { id: "delivery", label: "توصيل" },
    { id: "pickup", label: "استلام" },
    { id: "scheduled", label: "مجدول" },
  ];

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                background: filter === f.id ? C.amber : C.card,
                color: filter === f.id ? "#0B0F14" : C.sub,
                borderColor: C.border,
              }}
              className="px-3.5 py-2 rounded-lg text-[12px] font-bold border transition-colors"
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} style={{ color: C.muted }} className="absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث برقم الطلب أو العميل"
              style={{ background: C.card, borderColor: C.border, color: C.text }}
              className="rounded-lg border py-2 pr-8 pl-3 text-[12px] outline-none focus:border-amber-500 w-52"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: C.amber }}>
            <Bell size={14} /> صوت التنبيه مفعّل
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((o) => (
          <OrderCard key={o.id} order={o} onAccept={accept} onReject={reject} onAssign={assign} onView={setViewing} />
        ))}
        {filtered.length === 0 && (
          <div style={{ color: C.muted }} className="col-span-full text-center py-16 text-[13px]">
            لا توجد طلبات مطابقة
          </div>
        )}
      </div>

      <DriverGroupSection orders={orders} onUnassign={unassign} />
      <OrderDetailModal order={viewing} onClose={() => setViewing(null)} onReject={reject} />
    </div>
  );
}

/* ---------------------------------------------------------------
   SECTION 2 — PICKUP FROM BRANCH
---------------------------------------------------------------- */
function PickupBranch({ orders, setOrders }) {
  const [q, setQ] = useState("");
  const pickups = orders.filter((o) => o.type === "pickup");
  const filtered = pickups.filter(
    (o) => o.number.includes(q) || o.customer.includes(q) || o.phone.includes(q)
  );

  const stages = [
    { id: "waiting", label: "قائمة الانتظار", icon: Clock },
    { id: "ready", label: "جاهز للاستلام", icon: PackageCheck },
    { id: "arrived", label: "العميل وصل", icon: UserCheck },
    { id: "delivered", label: "تم التسليم", icon: Check },
  ];

  const advance = (id, next) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: next } : o)));
  const nextStage = { waiting: "ready", ready: "arrived", arrived: "delivered" };

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search size={15} style={{ color: C.muted }} className="absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث برقم الطلب أو اسم العميل أو الجوال"
            style={{ background: C.card, borderColor: C.border, color: C.text }}
            className="w-full rounded-lg border py-2.5 pr-9 pl-3 text-[13px] outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stages.map((stage) => {
          const items = filtered.filter((o) => o.status === stage.id);
          return (
            <div key={stage.id} style={{ background: C.surface, borderColor: C.border }} className="rounded-xl border p-3">
              <div className="flex items-center gap-2 mb-3 px-1">
                <stage.icon size={15} style={{ color: statusMeta[stage.id].color }} />
                <span className="text-[12px] font-extrabold" style={{ color: C.text }}>{stage.label}</span>
                <span style={{ color: C.muted }} className="text-[11px] font-bold mr-auto">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((o) => (
                  <div key={o.id} style={{ background: C.card, borderColor: C.border }} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-[12px] tabular-nums" style={{ color: C.text }}>{o.number}</span>
                      {stage.id !== "delivered" && <TimerRing remaining={o.remaining} total={o.prepTotal} size={36} />}
                    </div>
                    <div className="text-[12px] font-bold mb-0.5" style={{ color: C.text }}>{o.customer}</div>
                    <div dir="ltr" className="text-[11px] mb-2 text-right" style={{ color: C.sub }}>{o.phone}</div>
                    <div className="flex gap-1.5">
                      <IconBtn icon={Printer} label="" tone="default" small onClick={() => {}} />
                      {nextStage[stage.id] && (
                        <IconBtn
                          icon={ChevronLeft}
                          label={stages.find((s) => s.id === nextStage[stage.id])?.label}
                          tone="good"
                          small
                          onClick={() => advance(o.id, nextStage[stage.id])}
                        />
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="text-[11px] py-4 text-center" style={{ color: C.muted }}>لا شيء هنا</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   SECTION 3 — DRIVERS CENTER
---------------------------------------------------------------- */
function DriverCard({ d, onOpen }) {
  return (
    <button
      onClick={() => onOpen(d)}
      style={{ background: C.card, borderColor: C.border }}
      className="text-right rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:border-amber-500/40"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div style={{ background: C.border }} className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold" >
            {d.name[0]}
          </div>
          <div>
            <div className="font-extrabold text-[14px]" style={{ color: C.text }}>{d.name}</div>
            <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: d.online ? C.green : C.muted }}>
              <CircleDot size={8} fill={d.online ? C.green : C.muted} />
              {d.online ? "متصل" : "غير متصل"}
            </div>
          </div>
        </div>
        <Badge color={d.busy ? C.amber : C.green} soft>{d.busy ? "مشغول" : "متاح"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        {[
          ["طلبات نشطة", d.active],
          ["مكتملة اليوم", d.completedToday],
          ["أرباح اليوم", `${d.earnings} ر.س`],
          ["متوسط التوصيل", `${d.avgTime} د`],
        ].map(([label, val]) => (
          <div key={label} style={{ background: C.surface }} className="rounded-lg py-2">
            <div className="text-[13px] font-extrabold" style={{ color: C.text }}>{val}</div>
            <div className="text-[10px]" style={{ color: C.muted }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ borderColor: C.border }} className="border-t pt-2.5 flex items-center justify-between text-[12px]">
        <span style={{ color: C.muted }}>الرصيد المستحق</span>
        <span className="font-extrabold" style={{ color: d.balance > 0 ? C.amber : C.green }}>{d.balance} ر.س</span>
      </div>
    </button>
  );
}

function DriverDetail({ d, onClose }) {
  const [tab, setTab] = useState("current");
  const tabs = [
    { id: "current", label: "الطلبات الحالية" },
    { id: "completed", label: "الطلبات المكتملة" },
    { id: "history", label: "سجل التوصيل" },
    { id: "stats", label: "الإحصائيات" },
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "#0000008a" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, borderColor: C.border }}
        className="w-full max-w-2xl rounded-2xl border overflow-hidden max-h-[85vh] flex flex-col"
      >
        <div style={{ borderColor: C.border }} className="border-b p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ background: C.border }} className="w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-lg">
              {d.name[0]}
            </div>
            <div>
              <div className="font-extrabold text-[16px]" style={{ color: C.text }}>{d.name}</div>
              <div dir="ltr" className="text-[12px] text-right" style={{ color: C.sub }}>{d.phone}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: C.muted }}><X size={20} /></button>
        </div>

        <div className="grid grid-cols-4 gap-2 p-4" style={{ borderColor: C.border }}>
          {[
            ["النقد المحصّل", `${d.cashCollected} ر.س`, Banknote],
            ["رسوم التوصيل", `${d.active * 8} ر.س`, Truck],
            ["طلبات مكتملة", d.completedToday, PackageCheck],
            ["المبلغ المستحق للتسليم", `${d.balance} ر.س`, Wallet],
          ].map(([label, val, Icon]) => (
            <div key={label} style={{ background: C.card, borderColor: C.border }} className="rounded-xl border p-3 text-center">
              <Icon size={15} className="mx-auto mb-1.5" style={{ color: C.amber }} />
              <div className="text-[13px] font-extrabold" style={{ color: C.text }}>{val}</div>
              <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ borderColor: tab === t.id ? C.amber : "transparent", color: tab === t.id ? C.text : C.sub }}
              className="px-3 py-2 border-b-2 text-[12px] font-bold"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {tab === "current" && (
            <div className="flex flex-col gap-2">
              {[1, 2].slice(0, d.active).map((n) => (
                <div key={n} style={{ background: C.card, borderColor: C.border }} className="rounded-lg border p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[13px]" style={{ color: C.text }}>#{1040 + n} — {NAMES[n]}</div>
                    <div className="text-[11px] flex items-center gap-1 mt-1" style={{ color: C.sub }}><MapPin size={11} /> حي النزهة</div>
                  </div>
                  <Badge color={C.blue} soft>في الطريق</Badge>
                </div>
              ))}
              {d.active === 0 && <div className="text-center py-8 text-[13px]" style={{ color: C.muted }}>لا توجد طلبات حالية</div>}
            </div>
          )}
          {tab === "completed" && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ background: C.card, borderColor: C.border }} className="rounded-lg border p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[13px]" style={{ color: C.text }}>#{1020 + i} — {NAMES[i]}</div>
                    <div className="text-[11px] mt-1" style={{ color: C.sub }}>رسوم التوصيل: 8 ر.س · نقدي</div>
                  </div>
                  <Badge color={C.green} soft>تم التسليم</Badge>
                </div>
              ))}
            </div>
          )}
          {tab === "history" && (
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ color: C.muted }}>
                  <th className="text-right font-bold pb-2">الطلب</th>
                  <th className="text-right font-bold pb-2">العميل</th>
                  <th className="text-right font-bold pb-2">الرسوم</th>
                  <th className="text-right font-bold pb-2">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderColor: C.border }} className="border-t">
                    <td className="py-2 font-bold" style={{ color: C.text }}>#{1010 + i}</td>
                    <td className="py-2" style={{ color: C.sub }}>{NAMES[i]}</td>
                    <td className="py-2" style={{ color: C.sub }}>8 ر.س</td>
                    <td className="py-2" style={{ color: C.sub }}>{18 + i} د</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "stats" && (
            <div className="grid grid-cols-2 gap-3">
              {[
                ["إجمالي الطلبات المكتملة", d.completedToday * 6],
                ["إجمالي النقد المحصّل", `${d.cashCollected * 5} ر.س`],
                ["متوسط وقت التوصيل", `${d.avgTime} دقيقة`],
                ["تقييم الأداء", "4.8 / 5"],
              ].map(([label, val]) => (
                <div key={label} style={{ background: C.card, borderColor: C.border }} className="rounded-xl border p-4">
                  <div className="text-[16px] font-extrabold" style={{ color: C.text }}>{val}</div>
                  <div className="text-[11px] mt-1" style={{ color: C.muted }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DriversCenter() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const filtered = drivers.filter((d) => d.name.includes(q) || d.phone.includes(q));

  return (
    <div className="p-5">
      <div className="relative max-w-md mb-5">
        <Search size={15} style={{ color: C.muted }} className="absolute right-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث باسم السائق، الجوال، أو رقم الطلب"
          style={{ background: C.card, borderColor: C.border, color: C.text }}
          className="w-full rounded-lg border py-2.5 pr-9 pl-3 text-[13px] outline-none focus:border-amber-500"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((d) => (
          <DriverCard key={d.id} d={d} onOpen={setSelected} />
        ))}
      </div>
      {selected && <DriverDetail d={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ---------------------------------------------------------------
   SECTION 4 — FINANCIAL SUMMARY
---------------------------------------------------------------- */
function StatCard({ label, value, icon: Icon, trend, tone }) {
  const color = tone || C.amber;
  return (
    <div style={{ background: C.card, borderColor: C.border }} className="rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <div style={{ background: color + "1a", color }} className="w-8 h-8 rounded-lg flex items-center justify-center">
          <Icon size={15} strokeWidth={2.5} />
        </div>
        {trend != null && (
          <span className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: trend >= 0 ? C.green : C.red }}>
            {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-[18px] font-extrabold tabular-nums" style={{ color: C.text }}>{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{label}</div>
    </div>
  );
}

function FinancialSummary() {
  const net = finance.todaySales - finance.discounts - finance.refunds;
  return (
    <div className="p-5 flex flex-col gap-6">
      <div>
        <div className="text-[13px] font-extrabold mb-3" style={{ color: C.text }}>نظرة عامة على اليوم</div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="مبيعات اليوم" value={`${finance.todaySales.toLocaleString()} ر.س`} icon={TrendingUp} trend={8} />
          <StatCard label="مبيعات التوصيل" value={`${finance.deliverySales.toLocaleString()} ر.س`} icon={Truck} tone={C.blue} />
          <StatCard label="مبيعات الاستلام" value={`${finance.pickupSales.toLocaleString()} ر.س`} icon={Store} tone={C.green} />
          <StatCard label="صافي الإيراد" value={`${net.toLocaleString()} ر.س`} icon={DollarSign} trend={5} />
          <StatCard label="متوسط قيمة الطلب" value={`${finance.avgOrder} ر.س`} icon={Package} tone={C.violet} />
          <StatCard label="طلبات ملغاة" value={finance.cancelled} icon={AlertTriangle} tone={C.red} trend={-3} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div style={{ background: C.card, borderColor: C.border }} className="rounded-xl border p-4">
          <div className="text-[12px] font-extrabold mb-3" style={{ color: C.text }}>طرق الدفع</div>
          {[
            ["نقدي", finance.cash, Banknote, C.green],
            ["بطاقة", finance.card, CreditCard, C.blue],
            ["محفظة", finance.wallet, Smartphone, C.violet],
          ].map(([label, val, Icon, color]) => (
            <div key={label} className="flex items-center justify-between py-2" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: C.sub }}>
                <Icon size={14} style={{ color }} /> {label}
              </div>
              <span className="font-extrabold text-[13px]" style={{ color: C.text }}>{val.toLocaleString()} ر.س</span>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, borderColor: C.border }} className="rounded-xl border p-4">
          <div className="text-[12px] font-extrabold mb-3" style={{ color: C.text }}>الرسوم والخصومات</div>
          {[
            ["رسوم التوصيل", finance.deliveryFees],
            ["الخصومات", -finance.discounts],
            ["المبالغ المرتجعة", -finance.refunds],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center justify-between py-2">
              <span className="text-[12px] font-bold" style={{ color: C.sub }}>{label}</span>
              <span className="font-extrabold text-[13px]" style={{ color: val < 0 ? C.red : C.text }}>
                {val < 0 ? "-" : ""}{Math.abs(val).toLocaleString()} ر.س
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, borderColor: C.border }} className="rounded-xl border p-4">
          <div className="text-[12px] font-extrabold mb-3" style={{ color: C.text }}>حالة الطلبات</div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[12px] font-bold" style={{ color: C.sub }}>مكتملة</span>
            <Badge color={C.green} soft>{finance.completed}</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[12px] font-bold" style={{ color: C.sub }}>ملغاة</span>
            <Badge color={C.red} soft>{finance.cancelled}</Badge>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[13px] font-extrabold mb-3" style={{ color: C.text }}>أرصدة السائقين النقدية</div>
        <div style={{ background: C.card, borderColor: C.border }} className="rounded-xl border overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: C.surface, color: C.muted }}>
                <th className="text-right font-bold p-3">السائق</th>
                <th className="text-right font-bold p-3">النقد المحصّل</th>
                <th className="text-right font-bold p-3">رسوم التوصيل</th>
                <th className="text-right font-bold p-3">طلبات مكتملة</th>
                <th className="text-right font-bold p-3">المستحق للتسليم</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} style={{ borderColor: C.border }} className="border-t">
                  <td className="p-3 font-bold" style={{ color: C.text }}>{d.name}</td>
                  <td className="p-3" style={{ color: C.sub }}>{d.cashCollected} ر.س</td>
                  <td className="p-3" style={{ color: C.sub }}>{d.active * 8 + d.completedToday * 2} ر.س</td>
                  <td className="p-3" style={{ color: C.sub }}>{d.completedToday}</td>
                  <td className="p-3">
                    <span className="font-extrabold" style={{ color: d.balance > 0 ? C.amber : C.green }}>{d.balance} ر.س</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   APP ROOT
---------------------------------------------------------------- */
export default function App() {
  useTajawalFont();
  const [tab, setTab] = useState("incoming");
  const [orders, setOrders] = useState(initialOrders);
  const [clock, setClock] = useState("");

  // live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // live countdown for active orders — demonstrates real-time updates
  useEffect(() => {
    const t = setInterval(() => {
      setOrders((os) => os.map((o) => (["new", "preparing", "waiting", "ready"].includes(o.status) ? { ...o, remaining: Math.max(0, o.remaining - 1) } : o)));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const counts = {
    incoming: orders.filter((o) => ["new", "preparing"].includes(o.status) && !o.driver).length,
    pickup: orders.filter((o) => o.type === "pickup" && o.status !== "delivered").length,
    driversOnline: drivers.filter((d) => d.online).length,
  };

  return (
    <div dir="rtl" style={{ background: C.bg, fontFamily: "'Tajawal', system-ui, sans-serif" }} className="min-h-screen w-full">
      <TopBar tab={tab} setTab={setTab} counts={counts} now={clock} />
      <div className="max-w-[1400px] mx-auto">
        {tab === "incoming" && <IncomingOrders orders={orders} setOrders={setOrders} />}
        {tab === "pickup" && <PickupBranch orders={orders} setOrders={setOrders} />}
        {tab === "drivers" && <DriversCenter />}
        {tab === "finance" && <FinancialSummary />}
      </div>
    </div>
  );
}
