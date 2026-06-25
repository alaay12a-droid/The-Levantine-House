import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Order } from "@workspace/api-client-react";

const STATUS_STYLE: Record<string, string> = {
  done:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  preparing: "bg-blue-50 text-blue-700 border-blue-200",
  ready:     "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  done: "مكتمل", pending: "قيد الانتظار", preparing: "يُحضَّر", ready: "جاهز", cancelled: "ملغي",
};
const STATUS_DOT: Record<string, string> = {
  done: "bg-emerald-500", pending: "bg-yellow-400 animate-pulse", preparing: "bg-blue-500 animate-pulse",
  ready: "bg-green-500", cancelled: "bg-red-500",
};

function timeAgo(dt: string): string {
  const diff = Math.floor((Date.now() - new Date(dt).getTime()) / 60000);
  if (diff < 1)   return "الآن";
  if (diff < 60)  return `${diff} د`;
  if (diff < 1440) return `${Math.floor(diff / 60)} س`;
  return `${Math.floor(diff / 1440)} ي`;
}

interface Props { orders: Order[] | undefined; loading: boolean; }

export function RecentInvoices({ orders, loading }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧾</span>
          <h3 className="font-semibold text-base">آخر الفواتير</h3>
          {orders?.length ? (
            <Badge variant="secondary" className="text-[10px]">{orders.length}</Badge>
          ) : null}
        </div>
        <button onClick={() => setCollapsed(c => !c)} className="text-muted-foreground hover:text-foreground transition-colors">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        loading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !orders?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <span className="text-4xl">📭</span>
            <p className="font-medium">لا توجد فواتير بعد</p>
            <p className="text-sm">ستظهر الفواتير هنا عند استلام أول طلب</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["رقم الطلب","الوقت","العميل","المبلغ","طريقة الدفع","الحالة"].map(h => (
                    <th key={h} className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-primary">
                      #{order.dailyNumber}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${i < 3 ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                        {timeAgo(order.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium whitespace-nowrap">
                      {order.customerName || "—"}
                    </td>
                    <td className="py-3 px-4 font-bold text-primary whitespace-nowrap">
                      {(order.totalPrice / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                        {order.paymentMethod === "cash" ? "💵 نقدي" : "📱 إلكتروني"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[order.status] ?? ""}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[order.status] ?? "bg-gray-400"}`} />
                        {STATUS_LABELS[order.status] ?? order.status}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
