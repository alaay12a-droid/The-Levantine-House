import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { RevenueAggregate } from "@workspace/api-client-react";

function sar(v: number) {
  return v.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  change: number | null;
  icon: string;
  iconBg: string;
  accent: string;
}

function KpiCard({ label, value, sub, change, icon, iconBg, accent }: KpiCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pos = change !== null && change > 0;
  const neg = change !== null && change < 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group">
      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm", iconBg)}>
            {icon}
          </div>
          <button onClick={() => setCollapsed(c => !c)} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
        {!collapsed && (
          <>
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className={cn("mt-1 text-2xl font-bold tracking-tight", accent)}>{value}</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              {change !== null ? (
                <div className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                  change === 0 ? "bg-gray-100 text-gray-600" :
                  pos ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                )}>
                  {change === 0 ? <Minus className="h-3 w-3" /> : pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{change === 0 ? "لا تغيير" : `${Math.abs(change)}% ${pos ? "زيادة" : "انخفاض"}`}</span>
                </div>
              ) : <div />}
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  today: RevenueAggregate | undefined;
  loading: boolean;
}

export function KpiCards({ today, loading }: Props) {
  const t = today;
  const avg = t && t.orderCount > 0 ? t.totalRevenue / t.orderCount : 0;

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card shadow-sm p-5 animate-pulse">
            <div className="h-12 w-12 rounded-xl bg-muted mb-4" />
            <div className="h-4 w-24 bg-muted rounded mb-2" />
            <div className="h-7 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards: KpiCardProps[] = [
    {
      label: "إجمالي المبيعات اليوم",
      value: t ? sar(t.totalRevenue) : "لا توجد بيانات",
      sub: `${t?.orderCount ?? 0} طلب مكتمل`,
      change: null,
      icon: "💰", iconBg: "bg-emerald-50", accent: "text-emerald-700",
    },
    {
      label: "عدد الفواتير اليوم",
      value: t ? String(t.orderCount) : "٠",
      sub: `${t?.pendingCount ?? 0} قيد الانتظار`,
      change: null,
      icon: "🧾", iconBg: "bg-blue-50", accent: "text-blue-700",
    },
    {
      label: "صافي الإيرادات (بعد الضريبة)",
      value: t ? sar(t.netRevenue) : "لا توجد بيانات",
      sub: `ضريبة: ${t ? sar(t.taxAmount) : "٠"}`,
      change: null,
      icon: "📈", iconBg: "bg-amber-50", accent: "text-amber-700",
    },
    {
      label: "متوسط قيمة الفاتورة",
      value: t && t.orderCount > 0 ? sar(avg) : "٠",
      sub: t?.orderCount ? `من ${t.orderCount} طلب` : "لا توجد طلبات",
      change: null,
      icon: "📊", iconBg: "bg-violet-50", accent: "text-violet-700",
    },
    {
      label: "المبيعات المعلقة",
      value: t ? String(t.pendingCount) : "٠",
      sub: "لم تُكتمل بعد",
      change: null,
      icon: "⏳", iconBg: "bg-orange-50", accent: "text-orange-700",
    },
    {
      label: "الطلبات الملغاة",
      value: t ? String(t.cancelledCount) : "٠",
      sub: t ? sar(t.cancelledValue / 100) : "٠ ر.س",
      change: null,
      icon: "↩️", iconBg: "bg-red-50", accent: "text-red-700",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(c => <KpiCard key={c.label} {...c} />)}
    </div>
  );
}
