import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, TrendingUp, FileText, Users, Package, RotateCcw, Clock, DollarSign } from "lucide-react";
import { SaleRecord } from "./mock-data";

function fmt(h: number) { return (h / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س"; }

interface Props { sales: SaleRecord[]; loading?: boolean; }

export function StatsCards({ sales, loading }: Props) {
  const done = sales.filter(s => s.status === "done");
  const pending = sales.filter(s => s.status === "pending");
  const returned = sales.filter(s => s.status === "returned");

  const totalSales = done.reduce((a, s) => a + s.total, 0);
  const totalProfit = done.reduce((a, s) => a + s.profit, 0);
  const invoiceCount = done.length;
  const avgInvoice = invoiceCount ? totalSales / invoiceCount : 0;
  const uniqueCustomers = new Set(done.map(s => s.customer)).size;
  const totalQty = done.reduce((a, s) => a + s.quantity, 0);
  const pendingSales = pending.reduce((a, s) => a + s.total, 0);
  const returnedSales = returned.reduce((a, s) => a + s.total, 0);

  const cards = [
    { label: "إجمالي المبيعات", value: fmt(totalSales), icon: Banknote, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "إجمالي الأرباح", value: fmt(totalProfit), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "عدد الفواتير", value: String(invoiceCount), icon: FileText, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "متوسط قيمة الفاتورة", value: fmt(avgInvoice), icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "عدد العملاء", value: String(uniqueCustomers), icon: Users, color: "text-cyan-600", bg: "bg-cyan-50" },
    { label: "المنتجات المباعة", value: String(totalQty), icon: Package, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "المبيعات المعلقة", value: fmt(pendingSales), icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "المرتجعات", value: fmt(returnedSales), icon: RotateCcw, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <Card key={label} className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            <div className={`rounded-full p-2 ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className={`text-xl font-bold ${color}`}>{value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
