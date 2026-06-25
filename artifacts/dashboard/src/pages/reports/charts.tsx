import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SaleRecord, buildDailySales, buildMonthlySales, buildYearlySales, topBy, paymentBreakdown } from "./mock-data";

const PIE_COLORS = ["#0c48ab","#E8920C","#22c55e","#ec4899","#8b5cf6","#14b8a6"];

function sarK(v: number) { return (v / 100 / 1000).toFixed(1) + "K"; }

interface Props { sales: SaleRecord[]; }

export function SalesCharts({ sales }: Props) {
  const daily = buildDailySales(sales);
  const monthly = buildMonthlySales(sales);
  const yearly = buildYearlySales(sales);
  const topProducts = topBy(sales, "product");
  const topEmployees = topBy(sales, "employee");
  const topCustomers = topBy(sales, "customer");
  const payBreakdown = paymentBreakdown(sales);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">تحليل المبيعات والأرباح</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="daily">
            <TabsList className="mb-4">
              <TabsTrigger value="daily">يومي</TabsTrigger>
              <TabsTrigger value="monthly">شهري</TabsTrigger>
              <TabsTrigger value="yearly">سنوي</TabsTrigger>
            </TabsList>
            {[
              { key: "daily", data: daily, xKey: "date" },
              { key: "monthly", data: monthly, xKey: "month" },
              { key: "yearly", data: yearly, xKey: "year" },
            ].map(({ key, data, xKey }) => (
              <TabsContent key={key} value={key}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={sarK} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => sarK(v) + " ر.س"} />
                    <Legend formatter={n => n === "sales" ? "المبيعات" : "الأرباح"} />
                    <Line type="monotone" dataKey="sales" stroke="#0c48ab" strokeWidth={2} dot={false} name="sales" />
                    <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} dot={false} name="profit" />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">طرق الدفع</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={payBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {payBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => sarK(v) + " ر.س"} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">أفضل 10 منتجات</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topProducts} layout="vertical" margin={{ right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={sarK} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => sarK(v) + " ر.س"} />
                <Bar dataKey="sales" fill="#0c48ab" name="المبيعات" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">أفضل 10 موظفين</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topEmployees} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={sarK} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => sarK(v) + " ر.س"} />
                <Bar dataKey="sales" fill="#E8920C" name="المبيعات" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">أفضل 10 عملاء</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topCustomers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={sarK} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => sarK(v) + " ر.س"} />
                <Bar dataKey="sales" fill="#8b5cf6" name="المبيعات" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
