import { SaleRecord, filterByLastMinutes, TODAY, filterByDate, YESTERDAY } from "./mock-data";

function sar(h: number) {
  return (h / 100).toLocaleString("ar-SA", { minimumFractionDigits: 0 }) + " ر.س";
}

interface SmartCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  bg: string;
}

function SmartCard({ icon, label, value, sub, accent, bg }: SmartCardProps) {
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

interface Props { allSales: SaleRecord[]; }

function topProductToday(sales: SaleRecord[]) {
  const today = filterByDate(sales, TODAY);
  const map: Record<string, { count: number; sales: number }> = {};
  for (const s of today) {
    if (!map[s.product]) map[s.product] = { count: 0, sales: 0 };
    map[s.product].count += s.quantity;
    map[s.product].sales += s.total;
  }
  const sorted = Object.entries(map).sort(([,a],[,b]) => b.count - a.count);
  return sorted[0] ?? null;
}

function lowestProduct(sales: SaleRecord[]) {
  const done = sales.filter(s => s.status === "done");
  const map: Record<string, number> = {};
  for (const s of done) { map[s.product] = (map[s.product] ?? 0) + s.quantity; }
  const sorted = Object.entries(map).sort(([,a],[,b]) => a - b);
  return sorted[0] ?? null;
}

function lowSellingProducts(sales: SaleRecord[], threshold = 5) {
  const done = sales.filter(s => s.status === "done" && s.date === TODAY);
  const map: Record<string, number> = {};
  for (const s of done) { map[s.product] = (map[s.product] ?? 0) + s.quantity; }
  return Object.entries(map).filter(([,v]) => v <= threshold).map(([k]) => k);
}

function highestProfitProduct(sales: SaleRecord[]) {
  const done = sales.filter(s => s.status === "done");
  const map: Record<string, number> = {};
  for (const s of done) { map[s.product] = (map[s.product] ?? 0) + s.profit; }
  const sorted = Object.entries(map).sort(([,a],[,b]) => b - a);
  return sorted[0] ?? null;
}

export function SmartCards({ allSales }: Props) {
  const todaySales   = filterByDate(allSales, TODAY);
  const last60       = filterByLastMinutes(allSales, 60);
  const last30       = filterByLastMinutes(allSales, 30);

  const todayRevenue = todaySales.reduce((a, s) => a + s.total, 0);
  const todayProfit  = todaySales.reduce((a, s) => a + s.profit, 0);
  const todayQty     = todaySales.reduce((a, s) => a + s.quantity, 0);
  const last60Rev    = last60.reduce((a, s) => a + s.total, 0);
  const last30Rev    = last30.reduce((a, s) => a + s.total, 0);

  const topToday     = topProductToday(allSales);
  const topProfitP   = highestProfitProduct(allSales);
  const lowSales     = lowSellingProducts(allSales);
  const lowestP      = lowestProduct(allSales);

  const bestCustomer = (() => {
    const done = filterByDate(allSales, TODAY);
    const map: Record<string, number> = {};
    for (const s of done) { map[s.customer] = (map[s.customer] ?? 0) + s.total; }
    const sorted = Object.entries(map).sort(([,a],[,b]) => b - a);
    return sorted[0] ?? null;
  })();

  const bestEmployee = (() => {
    const done = filterByDate(allSales, TODAY);
    const map: Record<string, number> = {};
    for (const s of done) { map[s.employee] = (map[s.employee] ?? 0) + s.total; }
    const sorted = Object.entries(map).sort(([,a],[,b]) => b - a);
    return sorted[0] ?? null;
  })();

  const cards: SmartCardProps[] = [
    {
      icon: "🕐", label: "مبيعات آخر ساعة",
      value: sar(last60Rev), sub: `${last60.length} فاتورة`,
      accent: "text-blue-600", bg: "bg-blue-50/50 dark:bg-blue-950/20",
    },
    {
      icon: "⚡", label: "مبيعات آخر 30 دقيقة",
      value: sar(last30Rev), sub: `${last30.length} فاتورة`,
      accent: "text-indigo-600", bg: "bg-indigo-50/50 dark:bg-indigo-950/20",
    },
    {
      icon: "🔥", label: "أكثر صنف مبيعاً اليوم",
      value: topToday ? topToday[0] : "—",
      sub: topToday ? `${topToday[1].count} قطعة · ${sar(topToday[1].sales)}` : undefined,
      accent: "text-orange-600", bg: "bg-orange-50/50 dark:bg-orange-950/20",
    },
    {
      icon: "📦", label: "إجمالي القطع المباعة",
      value: String(todayQty) + " قطعة",
      sub: `من ${todaySales.length} فاتورة اليوم`,
      accent: "text-teal-600", bg: "bg-teal-50/50 dark:bg-teal-950/20",
    },
    {
      icon: "⭐", label: "الصنف الأعلى ربحاً",
      value: topProfitP ? topProfitP[0] : "—",
      sub: topProfitP ? sar(topProfitP[1]) : undefined,
      accent: "text-amber-600", bg: "bg-amber-50/50 dark:bg-amber-950/20",
    },
    {
      icon: "💰", label: "الأرباح المباشرة اليوم",
      value: sar(todayProfit),
      sub: `${Math.round((todayProfit / (todayRevenue || 1)) * 100)}% هامش ربح`,
      accent: "text-emerald-600", bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    },
    {
      icon: "⚠️", label: "أصناف قليلة المبيعات",
      value: lowSales.length > 0 ? `${lowSales.length} صنف` : "لا يوجد",
      sub: lowSales.slice(0, 2).join(" · ") || undefined,
      accent: "text-yellow-600", bg: "bg-yellow-50/50 dark:bg-yellow-950/20",
    },
    {
      icon: "📉", label: "أقل صنف مبيعاً",
      value: lowestP ? lowestP[0] : "—",
      sub: lowestP ? `${lowestP[1]} قطعة فقط` : undefined,
      accent: "text-red-600", bg: "bg-red-50/50 dark:bg-red-950/20",
    },
    {
      icon: "👑", label: "أفضل عميل اليوم",
      value: bestCustomer ? bestCustomer[0] : "—",
      sub: bestCustomer ? sar(bestCustomer[1]) : undefined,
      accent: "text-violet-600", bg: "bg-violet-50/50 dark:bg-violet-950/20",
    },
    {
      icon: "🏅", label: "أفضل موظف اليوم",
      value: bestEmployee ? bestEmployee[0] : "—",
      sub: bestEmployee ? sar(bestEmployee[1]) : undefined,
      accent: "text-pink-600", bg: "bg-pink-50/50 dark:bg-pink-950/20",
    },
  ];

  return (
    <div>
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">🧠</span> ذكاء المبيعات — لحظي
      </h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {cards.map(c => <SmartCard key={c.label} {...c} />)}
      </div>
    </div>
  );
}
