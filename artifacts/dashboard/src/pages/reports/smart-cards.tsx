import { RevenueData } from "@workspace/api-client-react";

function sar(v: number) {
  return v.toLocaleString("ar-SA", { minimumFractionDigits: 0 }) + " ر.س";
}

interface CardProps { icon: string; label: string; value: string; sub?: string; accent: string; bg: string; }

function SmartCard({ icon, label, value, sub, accent, bg }: CardProps) {
  return (
    <div className={`rounded-2xl border ${bg} p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className={`mt-1 text-lg font-bold leading-tight ${accent} truncate`}>{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

interface Props { revenue: RevenueData | undefined; loading: boolean; }

export function SmartCards({ revenue, loading }: Props) {
  if (loading) {
    return (
      <div>
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <span className="text-xl">🧠</span> مؤشرات ذكية
        </h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-muted/30 p-4 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  const today  = revenue?.today;
  const week   = revenue?.week;
  const month  = revenue?.month;
  const year   = revenue?.year;
  const top    = revenue?.topItems?.[0];
  const daily  = revenue?.dailyBreakdown ?? [];

  const todayAvg     = today && today.orderCount > 0 ? today.totalRevenue / today.orderCount : 0;
  const monthAvg     = month && month.orderCount > 0 ? month.totalRevenue / month.orderCount : 0;
  const cancRate     = year ? (year.cancelledCount / Math.max(1, year.cancelledCount + year.orderCount) * 100).toFixed(1) : "0";
  const bestDay      = [...daily].sort((a, b) => b.total - a.total)[0];
  const taxToday     = today?.taxAmount ?? 0;

  const empty = "لا توجد بيانات";

  const cards: CardProps[] = [
    {
      icon: "📅", label: "مبيعات هذا الأسبوع",
      value: week ? sar(week.totalRevenue) : "٠ ر.س",
      sub: week ? `${week.orderCount} طلب` : undefined,
      accent: "text-blue-600", bg: "bg-blue-50/50",
    },
    {
      icon: "📆", label: "مبيعات هذا الشهر",
      value: month ? sar(month.totalRevenue) : "٠ ر.س",
      sub: month ? `${month.orderCount} طلب` : undefined,
      accent: "text-indigo-600", bg: "bg-indigo-50/50",
    },
    {
      icon: "🔥", label: "الصنف الأكثر مبيعاً",
      value: top ? top.name : empty,
      sub: top ? `${top.qty} قطعة · ${sar(top.revenue)}` : undefined,
      accent: "text-orange-600", bg: "bg-orange-50/50",
    },
    {
      icon: "📊", label: "متوسط الطلب اليوم",
      value: today && today.orderCount > 0 ? sar(todayAvg) : "لا طلبات اليوم",
      sub: today ? `من ${today.orderCount} طلب` : undefined,
      accent: "text-teal-600", bg: "bg-teal-50/50",
    },
    {
      icon: "💹", label: "متوسط الطلب الشهري",
      value: month && month.orderCount > 0 ? sar(monthAvg) : "لا طلبات",
      sub: month ? `${month.orderCount} طلب هذا الشهر` : undefined,
      accent: "text-amber-600", bg: "bg-amber-50/50",
    },
    {
      icon: "🏆", label: "أعلى يوم مبيعات",
      value: bestDay && bestDay.total > 0 ? sar(bestDay.total) : empty,
      sub: bestDay && bestDay.total > 0 ? bestDay.date : undefined,
      accent: "text-emerald-600", bg: "bg-emerald-50/50",
    },
    {
      icon: "⚠️", label: "نسبة الإلغاء",
      value: `${cancRate}%`,
      sub: year ? `${year.cancelledCount} طلب ملغي هذا العام` : undefined,
      accent: "text-yellow-600", bg: "bg-yellow-50/50",
    },
    {
      icon: "🧾", label: "الضريبة المستحقة اليوم",
      value: today ? sar(taxToday) : "٠ ر.س",
      sub: "ضريبة القيمة المضافة 15%",
      accent: "text-red-600", bg: "bg-red-50/50",
    },
    {
      icon: "🚚", label: "إيرادات التوصيل اليوم",
      value: today ? sar(today.deliveryRevenue) : "٠ ر.س",
      sub: "رسوم التوصيل",
      accent: "text-violet-600", bg: "bg-violet-50/50",
    },
    {
      icon: "📈", label: "مبيعات هذا العام",
      value: year ? sar(year.totalRevenue) : "٠ ر.س",
      sub: year ? `${year.orderCount} طلب مكتمل` : undefined,
      accent: "text-pink-600", bg: "bg-pink-50/50",
    },
  ];

  return (
    <div>
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">🧠</span> مؤشرات ذكية
      </h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {cards.map(c => <SmartCard key={c.label} {...c} />)}
      </div>
    </div>
  );
}
