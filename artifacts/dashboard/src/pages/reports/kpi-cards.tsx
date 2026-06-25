import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaleRecord } from "./mock-data";

function sar(h: number) {
  return (h / 100).toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

interface KpiCardProps {
  label: string;
  value: string;
  subLabel?: string;
  subValue?: string;
  change: number;
  icon: string;
  gradient: string;
  iconBg: string;
}

function KpiCard({ label, value, subLabel, subValue, change, icon, gradient, iconBg }: KpiCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card shadow-sm",
        "transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group cursor-pointer"
      )}
    >
      <div className={cn("absolute inset-0 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity", gradient)} />

      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm", iconBg)}>
            {icon}
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <>
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                isNeutral ? "bg-gray-100 text-gray-600" :
                isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              )}>
                {isNeutral ? <Minus className="h-3 w-3" /> : isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{isNeutral ? "لا تغيير" : `${Math.abs(change)}% ${isPositive ? "زيادة" : "انخفاض"}`}</span>
              </div>
              {subLabel && (
                <div className="text-left">
                  <p className="text-[10px] text-muted-foreground">{subLabel}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{subValue}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  today: SaleRecord[];
  yesterday: SaleRecord[];
}

function pct(a: number, b: number) {
  if (b === 0) return a > 0 ? 100 : 0;
  return Math.round(((a - b) / b) * 100);
}

export function KpiCards({ today, yesterday }: Props) {
  const tDone = today.filter(s => s.status === "done");
  const yDone = yesterday.filter(s => s.status === "done");
  const tRet  = today.filter(s => s.status === "returned");
  const yRet  = yesterday.filter(s => s.status === "returned");

  const tSales   = tDone.reduce((a, s) => a + s.total, 0);
  const ySales   = yDone.reduce((a, s) => a + s.total, 0);
  const tProfit  = tDone.reduce((a, s) => a + s.profit, 0);
  const yProfit  = yDone.reduce((a, s) => a + s.profit, 0);
  const tCount   = tDone.length;
  const yCount   = yDone.length;
  const tAvg     = tCount ? tSales / tCount : 0;
  const yAvg     = yCount ? ySales / yCount : 0;
  const tCust    = new Set(tDone.map(s => s.customer)).size;
  const yCust    = new Set(yDone.map(s => s.customer)).size;
  const tRetAmt  = tRet.reduce((a, s) => a + s.total, 0);
  const yRetAmt  = yRet.reduce((a, s) => a + s.total, 0);

  const cards: KpiCardProps[] = [
    {
      label: "إجمالي المبيعات اليوم", value: sar(tSales),
      subLabel: "أمس", subValue: sar(ySales),
      change: pct(tSales, ySales),
      icon: "💰", gradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-50 dark:bg-emerald-900/30",
    },
    {
      label: "عدد الفواتير اليوم", value: String(tCount),
      subLabel: "أمس", subValue: String(yCount),
      change: pct(tCount, yCount),
      icon: "🧾", gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
      iconBg: "bg-blue-50 dark:bg-blue-900/30",
    },
    {
      label: "إجمالي الأرباح اليوم", value: sar(tProfit),
      subLabel: "أمس", subValue: sar(yProfit),
      change: pct(tProfit, yProfit),
      icon: "📈", gradient: "bg-gradient-to-br from-amber-400 to-orange-500",
      iconBg: "bg-amber-50 dark:bg-amber-900/30",
    },
    {
      label: "متوسط قيمة الفاتورة", value: sar(tAvg),
      subLabel: "أمس", subValue: sar(yAvg),
      change: pct(tAvg, yAvg),
      icon: "📊", gradient: "bg-gradient-to-br from-violet-500 to-purple-600",
      iconBg: "bg-violet-50 dark:bg-violet-900/30",
    },
    {
      label: "عدد العملاء", value: String(tCust),
      subLabel: "أمس", subValue: String(yCust),
      change: pct(tCust, yCust),
      icon: "👥", gradient: "bg-gradient-to-br from-orange-400 to-pink-500",
      iconBg: "bg-orange-50 dark:bg-orange-900/30",
    },
    {
      label: "المرتجعات", value: sar(tRetAmt),
      subLabel: "أمس", subValue: sar(yRetAmt),
      change: -pct(tRetAmt, yRetAmt),
      icon: "↩️", gradient: "bg-gradient-to-br from-red-500 to-rose-600",
      iconBg: "bg-red-50 dark:bg-red-900/30",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(c => <KpiCard key={c.label} {...c} />)}
    </div>
  );
}
