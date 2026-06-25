import {
  useGetRevenue, useListOrders, useGetDriverDailySummaries,
  getGetRevenueQueryKey, getListOrdersQueryKey, getGetDriverDailySummariesQueryKey,
} from "@workspace/api-client-react";
import { Printer, RefreshCw, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TodayKpis }     from "./today-kpis";
import { TodayItems }    from "./today-items";
import { TodayOrders }   from "./today-orders";
import { TodayDrivers }  from "./today-drivers";
import { PeriodSummary } from "./period-summary";
import { filterToday, aggregateItems } from "./utils";

export default function SalesReports() {
  const { data: revenue, isLoading: revLoading, refetch: refetchRevenue } =
    useGetRevenue({ query: { queryKey: getGetRevenueQueryKey(), refetchInterval: 60000 } });

  const ordersParams = { limit: 300 };
  const { data: ordersRaw, isLoading: ordersLoading, refetch: refetchOrders } =
    useListOrders(ordersParams, { query: { queryKey: getListOrdersQueryKey(ordersParams), refetchInterval: 30000 } });

  const { data: driverSummaries, isLoading: driversLoading, refetch: refetchDrivers } =
    useGetDriverDailySummaries({ query: { queryKey: getGetDriverDailySummariesQueryKey(), refetchInterval: 60000 } }) as any;

  const todayOrders = filterToday(ordersRaw ?? []);
  const itemsSold   = aggregateItems(todayOrders);
  const loading     = revLoading || ordersLoading;

  function refresh() { refetchRevenue(); refetchOrders(); refetchDrivers(); }

  const now = new Date();
  const dateLabel = now.toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh",
  });
  const timeLabel = now.toLocaleTimeString("ar-SA", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh",
  });

  return (
    <div className="space-y-6 report-page">

      {/* ── Print Header (only visible when printing) ── */}
      <div className="hidden print:block print:mb-6 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">روابي المندي للمذاق فن وأصول</h1>
            <p className="text-sm text-gray-600">تبوك - حي الروضة | 0530707042</p>
          </div>
          <div className="text-left text-sm text-gray-600">
            <p className="font-bold text-base">تقرير المبيعات اليومي</p>
            <p>{dateLabel}</p>
            <p>طُبع الساعة {timeLabel}</p>
          </div>
        </div>
      </div>

      {/* ── Screen Header ── */}
      <div className="print:hidden flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            تقرير المبيعات اليومي
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dateLabel} · {timeLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "جارٍ..." : "تحديث"}
          </Button>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Printer className="h-3.5 w-3.5" />
            طباعة التقرير
          </Button>
        </div>
      </div>

      <Separator className="print:hidden" />

      {/* ── Section 1: Today KPIs ── */}
      <div>
        <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5 print:text-xs">
          <span>📊</span> مؤشرات اليوم
        </h2>
        <TodayKpis today={revenue?.today} loading={revLoading} />
      </div>

      {/* ── Section 2: Items Sold Today ── */}
      <TodayItems items={itemsSold} loading={ordersLoading} />

      {/* ── Section 3: Today's Orders Table ── */}
      <TodayOrders orders={todayOrders} loading={ordersLoading} />

      {/* ── Section 4: Driver Stats ── */}
      <TodayDrivers summaries={driverSummaries} loading={driversLoading} />

      {/* ── Section 5: Period Comparison ── */}
      <PeriodSummary
        week={revenue?.week}
        month={revenue?.month}
        year={revenue?.year}
        loading={revLoading}
      />

      {/* ── Print Footer ── */}
      <div className="hidden print:block border-t pt-4 mt-6 text-center text-xs text-gray-500">
        <p>نظام إدارة مطعم روابي المندي — تقرير آلي · جميع المبالغ بالريال السعودي (ر.س) شاملة ضريبة القيمة المضافة 15%</p>
      </div>
    </div>
  );
}
