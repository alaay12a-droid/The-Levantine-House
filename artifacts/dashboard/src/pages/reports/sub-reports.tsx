import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SaleRecord, topBy, PAYMENT_LABELS } from "./mock-data";

function sar(h: number) { return (h / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2 }) + " ر.س"; }

function TopTable({ data, label }: { data: { name: string; sales: number; profit: number; count: number }[]; label: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2 pr-2 font-medium text-right">#</th>
            <th className="py-2 px-2 font-medium text-right">{label}</th>
            <th className="py-2 px-2 font-medium text-right">المبيعات</th>
            <th className="py-2 px-2 font-medium text-right">الأرباح</th>
            <th className="py-2 px-2 font-medium text-right">عدد</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.name} className="border-b hover:bg-muted/30 transition-colors">
              <td className="py-2 pr-2 text-muted-foreground font-mono text-xs">{i + 1}</td>
              <td className="py-2 px-2 font-medium">{row.name}</td>
              <td className="py-2 px-2 text-blue-600 font-semibold">{sar(row.sales)}</td>
              <td className="py-2 px-2 text-emerald-600 font-semibold">{sar(row.profit)}</td>
              <td className="py-2 px-2">
                <Badge variant="secondary">{row.count}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props { sales: SaleRecord[]; }

export function SubReports({ sales }: Props) {
  const done = sales.filter(s => s.status === "done");
  const returned = sales.filter(s => s.status === "returned");

  const byCustomer = topBy(sales, "customer", 15);
  const byEmployee = topBy(sales, "employee", 15);
  const byProduct = topBy(sales, "product", 15);
  const byBranch = topBy(sales, "branch", 10);

  const payments = (["cash","card","transfer","online"] as const).map(pm => {
    const subset = done.filter(s => s.paymentMethod === pm);
    return { name: PAYMENT_LABELS[pm], sales: subset.reduce((a,s) => a+s.total, 0), profit: 0, count: subset.length };
  }).filter(r => r.count > 0);

  const profits = [
    ...byBranch.map(r => ({ ...r, type: "فرع" })),
  ];

  const returnedByCustomer = topBy(returned, "customer", 10);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">التقارير التفصيلية</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="customer">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="customer">حسب العميل</TabsTrigger>
            <TabsTrigger value="employee">حسب الموظف</TabsTrigger>
            <TabsTrigger value="product">حسب المنتج</TabsTrigger>
            <TabsTrigger value="branch">حسب الفرع</TabsTrigger>
            <TabsTrigger value="payments">المدفوعات</TabsTrigger>
            <TabsTrigger value="profits">الأرباح</TabsTrigger>
            <TabsTrigger value="returns">المرتجعات</TabsTrigger>
          </TabsList>

          <TabsContent value="customer"><TopTable data={byCustomer} label="العميل" /></TabsContent>
          <TabsContent value="employee"><TopTable data={byEmployee} label="الموظف" /></TabsContent>
          <TabsContent value="product"><TopTable data={byProduct} label="المنتج" /></TabsContent>
          <TabsContent value="branch"><TopTable data={byBranch} label="الفرع" /></TabsContent>
          <TabsContent value="payments"><TopTable data={payments} label="طريقة الدفع" /></TabsContent>
          <TabsContent value="profits">
            <TopTable data={byBranch.map(r => ({ ...r }))} label="الفرع" />
          </TabsContent>
          <TabsContent value="returns">
            {returnedByCustomer.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد مرتجعات في الفترة المحددة</p>
            ) : (
              <TopTable data={returnedByCustomer} label="العميل" />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
