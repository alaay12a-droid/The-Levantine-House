import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SaleRecord, PAYMENT_LABELS, STATUS_LABELS, PaymentMethod, OrderStatus } from "./mock-data";

const STATUS_STYLE: Record<OrderStatus, string> = {
  done:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  returned:  "bg-orange-50 text-orange-600 border-orange-200",
};

const STATUS_DOT: Record<OrderStatus, string> = {
  done: "bg-emerald-500", pending: "bg-yellow-400", cancelled: "bg-red-500", returned: "bg-orange-500",
};

function timeAgo(dt: string): string {
  const now  = new Date("2026-06-25T19:30:00").getTime();
  const diff = Math.floor((now - new Date(dt).getTime()) / 60000);
  if (diff < 1)  return "الآن";
  if (diff < 60) return `${diff} د`;
  if (diff < 1440) return `${Math.floor(diff / 60)} س`;
  return `${Math.floor(diff / 1440)} ي`;
}

function sar(h: number) {
  return (h / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2 }) + " ر.س";
}

interface Props { sales: SaleRecord[]; }

export function RecentInvoices({ sales }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const recent = sales.slice(0, 15);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧾</span>
          <h3 className="font-semibold text-base">آخر الفواتير</h3>
          <Badge variant="secondary" className="text-[10px]">{recent.length}</Badge>
        </div>
        <button onClick={() => setCollapsed(c => !c)} className="text-muted-foreground hover:text-foreground transition-colors">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["رقم الفاتورة","الوقت","العميل","المبلغ","الموظف","طريقة الدفع","الحالة"].map(h => (
                  <th key={h} className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((s, i) => (
                <tr
                  key={s.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors group"
                >
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-primary">
                    {s.invoiceNo}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${i < 3 ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                      {timeAgo(s.datetime)}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium whitespace-nowrap">{s.customer}</td>
                  <td className="py-3 px-4 font-bold text-primary whitespace-nowrap">{sar(s.total)}</td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{s.employee}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {{ cash:"💵", card:"💳", transfer:"🏦", online:"📱" }[s.paymentMethod as PaymentMethod]}
                      {PAYMENT_LABELS[s.paymentMethod]}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[s.status]}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s.status]}`} />
                      {STATUS_LABELS[s.status]}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
