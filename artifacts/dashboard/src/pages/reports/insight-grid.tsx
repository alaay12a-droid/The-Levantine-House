import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SaleRecord, topBy, paymentBreakdown } from "./mock-data";

function sarK(v: number) { return (v / 100000).toFixed(1) + "K"; }

const PIE_COLORS = ["#0c48ab","#E8920C","#22c55e","#ec4899","#8b5cf6","#14b8a6"];

function InsightCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <button onClick={() => setCollapsed(c => !c)} className="text-muted-foreground hover:text-foreground transition-colors">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
      {!collapsed && <div className="p-4">{children}</div>}
    </div>
  );
}

interface Props { sales: SaleRecord[]; }

export function InsightGrid({ sales }: Props) {
  const topProducts  = topBy(sales, "product",  10);
  const topCustomers = topBy(sales, "customer",  8);
  const topEmployees = topBy(sales, "employee",  8);
  const payBreak     = paymentBreakdown(sales);

  return (
    <div className="grid gap-5 md:grid-cols-2">

      {/* أكثر 10 أصناف مبيعاً */}
      <InsightCard title="أكثر 10 أصناف مبيعاً" icon="📦">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={topProducts} layout="vertical" margin={{ right: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} horizontal={false} />
            <XAxis type="number" tickFormatter={sarK} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number) => [`${(v / 100).toLocaleString("ar-SA")} ر.س`, "المبيعات"]} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
            <Bar dataKey="sales" fill="#0c48ab" radius={[0, 6, 6, 0]} maxBarSize={18}>
              {topProducts.map((_, i) => (
                <Cell key={i} fill={`hsl(${220 + i * 5}, 70%, ${55 - i * 2}%)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </InsightCard>

      {/* أفضل العملاء */}
      <InsightCard title="أفضل العملاء" icon="👥">
        <div className="space-y-2.5">
          {topCustomers.map((c, i) => {
            const maxSales = topCustomers[0].sales;
            const pct = (c.sales / maxSales) * 100;
            return (
              <div key={c.name} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-primary">{(c.sales / 100).toLocaleString("ar-SA")} ر.س</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-blue-600 to-indigo-500 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </InsightCard>

      {/* أفضل الموظفين */}
      <InsightCard title="أفضل الموظفين مبيعاً" icon="🏆">
        <div className="space-y-2.5">
          {topEmployees.map((e, i) => {
            const maxSales = topEmployees[0].sales;
            const pct = (e.sales / maxSales) * 100;
            const medals = ["🥇","🥈","🥉"];
            return (
              <div key={e.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{medals[i] ?? `${i + 1}`}</span>
                    <span className="text-sm font-medium">{e.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{e.count} فاتورة</span>
                  </div>
                  <span className="text-xs font-semibold text-amber-600">{(e.sales / 100).toLocaleString("ar-SA")} ر.س</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-amber-500 to-orange-400 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </InsightCard>

      {/* طرق الدفع */}
      <InsightCard title="المبيعات حسب طريقة الدفع" icon="💳">
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="55%" height={220}>
            <PieChart>
              <Pie data={payBreak} dataKey="value" cx="50%" cy="50%" outerRadius={85} innerRadius={40} paddingAngle={3}>
                {payBreak.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${(v / 100).toLocaleString("ar-SA")} ر.س`]} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-3">
            {payBreak.map((p, i) => {
              const total = payBreak.reduce((a, x) => a + x.value, 0);
              const pct = total ? Math.round((p.value / total) * 100) : 0;
              return (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs font-medium">{p.name}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold">{pct}%</span>
                    <div className="text-[10px] text-muted-foreground">{(p.value / 100).toLocaleString("ar-SA")} ر.س</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </InsightCard>

    </div>
  );
}
