import { useGetRevenue, useListOrders, getGetRevenueQueryKey, getListOrdersQueryKey } from "@workspace/api-client-react";
import { BarChart2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { KpiCards }       from "./kpi-cards";
import { TrendChart }     from "./trend-chart";
import { InsightGrid }    from "./insight-grid";
import { SmartCards }     from "./smart-cards";
import { RecentInvoices } from "./recent-invoices";

export default function SalesReports() {
  const { data: revenue, isLoading: revLoading, refetch: refetchRevenue } =
    useGetRevenue({ query: { queryKey: getGetRevenueQueryKey(), refetchInterval: 60000 } });

  const ordersParams = { limit: 50 };
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } =
    useListOrders(ordersParams, { query: { queryKey: getListOrdersQueryKey(ordersParams), refetchInterval: 30000 } });

  const loading = revLoading || ordersLoading;

  function refresh() {
    refetchRevenue();
    refetchOrders();
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  return (
    <div className="space-y-7">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            لوحة تقارير المبيعات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{dateLabel}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "جارٍ التحديث..." : "تحديث البيانات"}
        </Button>
      </div>

      <Separator />

      {/* ── Section 1: KPI Cards (today) ── */}
      <KpiCards today={revenue?.today} loading={revLoading} />

      {/* ── Section 2: Trend Chart ── */}
      <TrendChart revenue={revenue} loading={revLoading} />

      {/* ── Section 3: 2×2 Insight Grid ── */}
      <InsightGrid revenue={revenue} loading={revLoading} />

      {/* ── Section 4: Smart Live Cards ── */}
      <SmartCards revenue={revenue} loading={revLoading} />

      {/* ── Section 5: Recent Invoices ── */}
      <RecentInvoices orders={orders} loading={ordersLoading} />

    </div>
  );
}
