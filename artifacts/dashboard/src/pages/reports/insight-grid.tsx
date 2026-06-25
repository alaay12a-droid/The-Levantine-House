import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RevenueData } from "@workspace/api-client-react";

const PIE_COLORS = ["#0c48ab","#E8920C","#22c55e","#ec4899"];

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

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
      <span className="text-3xl">📭</span>
      <p className="text-sm">لا توجد بيانات</p>
    </div>
  );
}

interface Props { revenue: RevenueData | undefined; loading: boolean; }

export function InsightGrid({ revenue, loading }: Props) {
  const topItems   = revenue?.topItems ?? [];
  const daily      = revenue?.dailyBreakdown ?? [];

  const cashTotal   = daily.reduce((a, d) => a + d.cashCount,   0);
  const onlineTotal = daily.reduce((a, d) => a + d.onlineCount, 0);
  const payBreak = [
    { name: "نقدي",      value: cashTotal },
    { name: "إلكتروني", value: onlineTotal },
  ].filter(p => p.value > 0);

  const cancelledTotal = daily.reduce((a, d) => a + d.cancelledCount, 0);
  const doneTotal      = daily.reduce((a, d) => a + d.orders, 0);
  const statusBreak = [
    { name: "مكتمل",  value: doneTotal },
    { name: "ملغي",   value: cancelledTotal },
  ].filter(p => p.value > 0);

  if (loading) {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-2xl border bg-card p-6 animate-pulse">
            <div className="h-5 w-40 bg-muted rounded mb-4" />
            <div className="h-48 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">

      {/* أكثر 10 أصناف */}
      <InsightCard title="أكثر 10 أصناف مبيعاً هذا العام" icon="📦">
        {topItems.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topItems} layout="vertical" margin={{ right: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number, name: string) => [v, name === "qty" ? "قطعة" : "ر.س"]}
                contentStyle={{ borderRadius: 10, fontSize: 11 }} />
              <Bar dataKey="qty" name="qty" radius={[0, 6, 6, 0]} maxBarSize={18}>
                {topItems.map((_, i) => <Cell key={i} fill={`hsl(${220 + i * 5}, 70%, ${55 - i * 2}%)`} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </InsightCard>

      {/* مبيعات حسب الأيام */}
      <InsightCard title="المبيعات اليومية (آخر 30 يوم)" icon="📅">
        {daily.every(d => d.total === 0) ? <Empty /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={daily.slice(-14)} margin={{ right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => v > 999 ? (v/1000).toFixed(1)+"K" : v} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString("ar-SA")} ر.س`]}
                contentStyle={{ borderRadius: 10, fontSize: 11 }} />
              <Bar dataKey="total" name="المبيعات" fill="#0c48ab" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </InsightCard>

      {/* طريقة الدفع */}
      <InsightCard title="توزيع طرق الدفع" icon="💳">
        {payBreak.length === 0 ? <Empty /> : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={payBreak} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={35} paddingAngle={3}>
                  {payBreak.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} طلب`]} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-4">
              {payBreak.map((p, i) => {
                const total = payBreak.reduce((a, x) => a + x.value, 0);
                const pct   = total ? Math.round((p.value / total) * 100) : 0;
                return (
                  <div key={p.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <span className="font-bold">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PIE_COLORS[i] }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.value} طلب</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </InsightCard>

      {/* حالة الطلبات */}
      <InsightCard title="توزيع حالة الطلبات" icon="📋">
        {statusBreak.length === 0 ? <Empty /> : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={statusBreak} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={35} paddingAngle={3}>
                  {statusBreak.map((_, i) => <Cell key={i} fill={["#22c55e","#ef4444","#f59e0b","#6366f1"][i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} طلب`]} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-4">
              {statusBreak.map((s, i) => {
                const total = statusBreak.reduce((a, x) => a + x.value, 0);
                const pct   = total ? Math.round((s.value / total) * 100) : 0;
                const colors = ["#22c55e","#ef4444","#f59e0b","#6366f1"];
                return (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} />
                        <span className="font-medium">{s.name}</span>
                      </div>
                      <span className="font-bold">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[i] }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.value} طلب</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </InsightCard>

    </div>
  );
}
