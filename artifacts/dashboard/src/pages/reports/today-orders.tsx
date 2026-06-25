import { useState } from "react";
import { Order } from "@workspace/api-client-react";
import { sar, formatTime, STATUS_AR, STATUS_COLOR } from "./utils";

interface Props { orders: Order[]; loading: boolean; }

export function TodayOrders({ orders, loading }: Props) {
  const [filter, setFilter] = useState<string>("all");

  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const total = orders.filter(o => o.status !== "cancelled").reduce((a, o) => a + o.totalPrice / 100, 0);

  const tabs = [
    { key: "all",       label: `الكل (${orders.length})` },
    { key: "done",      label: `مكتملة (${statusCounts.done ?? 0})` },
    { key: "pending",   label: `انتظار (${statusCounts.pending ?? 0})` },
    { key: "preparing", label: `يُحضَّر (${statusCounts.preparing ?? 0})` },
    { key: "cancelled", label: `ملغي (${statusCounts.cancelled ?? 0})` },
  ];

  return (
    <section className="rounded-xl border bg-card shadow-sm overflow-hidden print:shadow-none print:border-gray-300">
      {/* Header */}
      <div className="px-5 py-3 border-b bg-blue-50/60 print:bg-blue-50 print:py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h2 className="font-bold text-base print:text-sm">جميع طلبات اليوم</h2>
          </div>
          {!loading && (
            <span className="text-xs text-blue-700 font-semibold bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full print:text-[10px]">
              إجمالي: {sar(total)}
            </span>
          )}
        </div>

        {/* Filter tabs — hidden in print */}
        <div className="flex gap-1 flex-wrap print:hidden">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium ${
                filter === t.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-muted-foreground border-gray-200 hover:border-blue-300"
              }`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 w-full bg-muted/40 rounded animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <span className="text-3xl">📭</span>
          <p className="font-medium text-sm">لا توجد طلبات اليوم بعد</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm print:text-[10px]">
            <thead>
              <tr className="border-b bg-muted/30 text-right">
                {["#","العميل","الوقت","الأصناف","المبلغ","الدفع","الحالة"].map(h => (
                  <th key={h} className="py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id} className={`border-b last:border-0 transition-colors print:border-gray-200 ${order.status === "cancelled" ? "opacity-50" : "hover:bg-muted/20"}`}>
                  <td className="py-2.5 px-3 font-mono font-bold text-primary text-xs">
                    #{order.dailyNumber}
                  </td>
                  <td className="py-2.5 px-3 font-medium whitespace-nowrap max-w-[120px] truncate">
                    {order.customerName || "—"}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap text-xs">
                    {formatTime(order.createdAt)}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[180px]">
                    <span className="line-clamp-1">
                      {order.items.map(i => `${i.name} ×${i.quantity}`).join("، ")}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-emerald-700 whitespace-nowrap">
                    {sar(order.totalPrice / 100)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs">{order.paymentMethod === "cash" ? "💵 نقدي" : "📱 إلكتروني"}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${STATUS_COLOR[order.status] ?? ""}`}>
                      {STATUS_AR[order.status] ?? order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
