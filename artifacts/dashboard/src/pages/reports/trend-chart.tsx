import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { RevenueData } from "@workspace/api-client-react";

const TABS = [
  { key: "daily",   label: "آخر 30 يوم" },
  { key: "monthly", label: "الشهور"    },
] as const;
type Tab = typeof TABS[number]["key"];

interface Props { revenue: RevenueData | undefined; loading: boolean; }

export function TrendChart({ revenue, loading }: Props) {
  const [tab, setTab]           = useState<Tab>("daily");
  const [collapsed, setCollapsed] = useState(false);

  const data = tab === "daily"
    ? (revenue?.dailyBreakdown ?? []).map(d => ({ label: d.date, sales: d.total, net: d.net }))
    : (revenue?.monthlyBreakdown ?? []).map(d => ({ label: d.month, sales: d.total, net: d.net }));

  const totalSales = data.reduce((a, d) => a + d.sales, 0);
  const hasData    = data.some(d => d.sales > 0);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h3 className="font-semibold text-base">تحليل المبيعات</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasData ? `${totalSales.toLocaleString("ar-SA")} ر.س إجمالي` : "لا توجد بيانات"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  tab === t.key ? "bg-white dark:bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >{t.label}</button>
            ))}
          </div>
          <button onClick={() => setCollapsed(c => !c)} className="text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-6">
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !hasData ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2">
              <span className="text-4xl">📊</span>
              <p className="font-medium">لا توجد بيانات مبيعات بعد</p>
              <p className="text-sm">ستظهر الرسوم البيانية عند اكتمال أول طلب</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0c48ab" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0c48ab" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v > 999 ? (v/1000).toFixed(1)+"K" : v} />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    `${v.toLocaleString("ar-SA")} ر.س`,
                    name === "sales" ? "المبيعات الإجمالية" : "صافي الإيرادات"
                  ]}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Legend formatter={n => n === "sales" ? "المبيعات الإجمالية" : "صافي الإيرادات"} />
                <Area type="monotone" dataKey="sales" stroke="#0c48ab" strokeWidth={2} fill="url(#gradSales)" dot={false} name="sales" />
                <Area type="monotone" dataKey="net"   stroke="#22c55e" strokeWidth={2} fill="url(#gradNet)"   dot={false} name="net"   />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
