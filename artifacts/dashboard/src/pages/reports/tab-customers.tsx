import { Order } from "@workspace/api-client-react";
import { sarShort, sar, filterToday } from "./utils";
import { downloadCSV } from "./export-utils";

interface CustomerStat {
  phone:       string;
  name:        string;
  orderCount:  number;
  totalSpent:  number;
  lastOrder:   string;
  avgOrder:    number;
}

function buildCustomerStats(orders: Order[]): CustomerStat[] {
  const map = new Map<string, CustomerStat>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const cur = map.get(o.customerPhone) ?? {
      phone: o.customerPhone, name: o.customerName,
      orderCount: 0, totalSpent: 0, lastOrder: o.createdAt, avgOrder: 0,
    };
    cur.orderCount++;
    cur.totalSpent += o.totalPrice / 100;
    if (new Date(o.createdAt) > new Date(cur.lastOrder)) cur.lastOrder = o.createdAt;
    if (!cur.name && o.customerName) cur.name = o.customerName;
    map.set(o.customerPhone, cur);
  }
  return Array.from(map.values())
    .map(c => ({ ...c, avgOrder: c.totalSpent / c.orderCount }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-3);
}

interface Props { orders: Order[]; loading: boolean; }

export function TabCustomers({ orders, loading }: Props) {
  const allCustomers  = buildCustomerStats(orders);
  const todayOrders   = filterToday(orders);
  const todayCustomers = buildCustomerStats(todayOrders);

  const topAll    = allCustomers.slice(0, 20);
  const topToday  = todayCustomers.slice(0, 10);
  const returning = allCustomers.filter(c => c.orderCount > 1).length;
  const newCust   = allCustomers.filter(c => c.orderCount === 1).length;

  function exportCustomers() {
    downloadCSV(
      topAll.map((c, idx) => ({
        "الترتيب": idx + 1,
        "الجوال": maskPhone(c.phone),
        "عدد الطلبات": c.orderCount,
        "إجمالي الإنفاق (ر.س)": c.totalSpent.toFixed(2),
        "متوسط الطلب (ر.س)": c.avgOrder.toFixed(2),
      })),
      "أفضل_العملاء.csv",
      true,
    );
  }

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl border bg-muted/30 animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: "👥", label: "إجمالي العملاء", value: String(allCustomers.length), accent: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
          { icon: "🔄", label: "عملاء متكررون", value: String(returning), accent: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
          { icon: "🆕", label: "عملاء جدد", value: String(newCust), accent: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
          { icon: "📅", label: "عملاء اليوم", value: String(todayCustomers.length), accent: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border ${c.bg} ${c.border} p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{c.icon}</span>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Export */}
      <div className="flex justify-end print:hidden">
        <button onClick={exportCustomers}
          className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors font-medium">
          📊 تصدير Excel
        </button>
      </div>

      {/* Today's customers */}
      {topToday.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 print:p-3">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><span>📅</span> عملاء اليوم</h3>
          <CustomerTable customers={topToday} />
        </section>
      )}

      {/* All-time top customers */}
      <section className="rounded-2xl border bg-card p-5 print:p-3">
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          <span>🏆</span> أفضل 20 عميل (كل الوقت)
        </h3>
        {topAll.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <span className="text-3xl">📭</span>
            <p className="text-sm">لا توجد بيانات</p>
          </div>
        ) : (
          <CustomerTable customers={topAll} showRank />
        )}
      </section>

      {/* Privacy note */}
      <p className="text-[11px] text-muted-foreground text-center print:hidden">
        🔒 أرقام الجوال مُخفية جزئياً للخصوصية
      </p>
    </div>
  );
}

function CustomerTable({ customers, showRank }: { customers: CustomerStat[]; showRank?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm print:text-[10px]">
        <thead>
          <tr className="border-b bg-muted/30">
            {showRank && <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">#</th>}
            {["الجوال","الطلبات","إجمالي الإنفاق","متوسط الطلب","آخر طلب"].map(h => (
              <th key={h} className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map((c, idx) => (
            <tr key={c.phone} className="border-b last:border-0 hover:bg-muted/20">
              {showRank && (
                <td className="py-2.5 px-3">
                  <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                    idx === 0 ? "bg-amber-400 text-white" : idx === 1 ? "bg-gray-300 text-gray-700" : idx === 2 ? "bg-orange-300 text-white" : "bg-muted text-muted-foreground"
                  }`}>{idx+1}</span>
                </td>
              )}
              <td className="py-2.5 px-3 font-mono text-xs">{maskPhone(c.phone)}</td>
              <td className="py-2.5 px-3">
                <span className="inline-flex items-center gap-1">
                  <span className="font-bold text-primary">{c.orderCount}</span>
                  {c.orderCount > 3 && <span className="text-[10px] text-emerald-600 font-semibold">متكرر</span>}
                </span>
              </td>
              <td className="py-2.5 px-3 font-bold text-emerald-700">{sar(c.totalSpent)}</td>
              <td className="py-2.5 px-3 text-xs text-muted-foreground">{sarShort(c.avgOrder)}</td>
              <td className="py-2.5 px-3 text-xs text-muted-foreground">
                {new Date(c.lastOrder).toLocaleDateString("ar-SA", {timeZone:"Asia/Riyadh", month:"short", day:"numeric"})}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
