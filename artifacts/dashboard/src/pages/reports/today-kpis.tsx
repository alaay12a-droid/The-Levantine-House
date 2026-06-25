import { RevenueAggregate } from "@workspace/api-client-react";
import { sarShort } from "./utils";

interface Props { today: RevenueAggregate | undefined; loading: boolean; }

interface CardDef { label: string; value: string; sub: string; icon: string; bg: string; text: string; border: string; }

export function TodayKpis({ today, loading }: Props) {
  const avg = today && today.orderCount > 0 ? today.totalRevenue / today.orderCount : 0;

  const cards: CardDef[] = [
    {
      label: "إجمالي مبيعات اليوم",
      value: today ? sarShort(today.totalRevenue) : "٠ ر.س",
      sub: `${today?.orderCount ?? 0} فاتورة مكتملة`,
      icon: "💰", bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200",
    },
    {
      label: "صافي الإيرادات",
      value: today ? sarShort(today.netRevenue) : "٠ ر.س",
      sub: `ضريبة: ${today ? sarShort(today.taxAmount) : "٠"}`,
      icon: "📈", bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200",
    },
    {
      label: "عدد الحسابات",
      value: String(today?.orderCount ?? 0),
      sub: `${today?.pendingCount ?? 0} قيد الانتظار`,
      icon: "🧾", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200",
    },
    {
      label: "متوسط الحساب",
      value: today && today.orderCount > 0 ? sarShort(avg) : "—",
      sub: today?.orderCount ? `من ${today.orderCount} طلب` : "لا طلبات",
      icon: "📊", bg: "bg-violet-50", text: "text-violet-800", border: "border-violet-200",
    },
    {
      label: "مبيعات نقدي",
      value: today ? sarShort(today.cashRevenue) : "٠ ر.س",
      sub: `${today?.cashCount ?? 0} فاتورة`,
      icon: "💵", bg: "bg-teal-50", text: "text-teal-800", border: "border-teal-200",
    },
    {
      label: "طلبات ملغاة",
      value: String(today?.cancelledCount ?? 0),
      sub: today ? sarShort(today.cancelledValue / 100) + " خسارة" : "—",
      icon: "↩️", bg: "bg-red-50", text: "text-red-800", border: "border-red-200",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-3 print:gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-muted/30 p-4 animate-pulse h-[100px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-3 print:gap-2">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl border ${c.bg} ${c.border} p-4 print:p-2`}>
          <div className="flex items-start gap-2 mb-2">
            <span className="text-xl leading-none print:text-base">{c.icon}</span>
            <p className="text-[11px] font-medium text-muted-foreground leading-tight print:text-[10px]">{c.label}</p>
          </div>
          <p className={`text-xl font-bold ${c.text} leading-tight print:text-base`}>{c.value}</p>
          <p className="text-[10px] text-muted-foreground mt-1 print:text-[9px]">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
