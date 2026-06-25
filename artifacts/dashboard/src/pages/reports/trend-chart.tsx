import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaleRecord, buildHourlySales, buildDailySales, buildMonthlySales, buildYearlySales, TODAY } from "./mock-data";

function sarK(v: number) {
  if (v >= 100000) return (v / 100000).toFixed(1) + "K";
  return (v / 100).toFixed(0);
}

const TABS = [
  { key: "today",   label: "اليوم" },
  { key: "week",    label: "الأسبوع" },
  { key: "month",   label: "الشهر" },
  { key: "year",    label: "السنة" },
] as const;

type Tab = typeof TABS[number]["key"];

interface Props { sales: SaleRecord[]; }

export function TrendChart({ sales }: Props) {
  const [tab, setTab]         = useState<Tab>("month");
  const [collapsed, setCollapsed] = useState(false);

  const data = (() => {
    if (tab === "today") {
      return buildHourlySales(sales, TODAY).map(d => ({
        label: d.hour, sales: d.sales, profit: 0, count: d.count
      }));
    }
    if (tab === "week") {
      return buildDailySales(sales).slice(-7).map(d => ({
        label: d.date, sales: d.sales, profit: d.profit
      }));
    }
    if (tab === "month") {
      return buildDailySales(sales).slice(-30).map(d => ({
        label: d.date, sales: d.sales, profit: d.profit
      }));
    }
    return buildYearlySales(sales).map(d => ({
      label: d.year, sales: d.sales, profit: d.profit
    }));
  })();

  const totalSales  = data.reduce((a, d) => a + d.sales, 0);
  const totalProfit = data.reduce((a, d) => a + ("profit" in d ? d.profit : 0), 0);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="font-semibold text-base">تحليل المبيعات والأرباح</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(totalSales / 100).toLocaleString("ar-SA")} ر.س إجمالي مبيعات
              {totalProfit > 0 && ` · ${(totalProfit / 100).toLocaleString("ar-SA")} ر.س أرباح`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  tab === t.key
                    ? "bg-white dark:bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => setCollapsed(c => !c)} className="text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-6">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0c48ab" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0c48ab" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={sarK} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v: number, name: string) =>
                  [`${(v / 100).toLocaleString("ar-SA")} ر.س`, name === "sales" ? "المبيعات" : "الأرباح"]
                }
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              />
              <Legend formatter={n => n === "sales" ? "المبيعات" : "الأرباح"} />
              <Area type="monotone" dataKey="sales"  stroke="#0c48ab" strokeWidth={2} fill="url(#gradSales)"  dot={false} name="sales" />
              {tab !== "today" && (
                <Area type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} fill="url(#gradProfit)" dot={false} name="profit" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
