import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Printer, FileDown, Sheet, FileText, Image, RefreshCw, BarChart2 } from "lucide-react";
import { KpiCards }       from "./kpi-cards";
import { TrendChart }     from "./trend-chart";
import { InsightGrid }    from "./insight-grid";
import { SmartCards }     from "./smart-cards";
import { RecentInvoices } from "./recent-invoices";
import { ReportFilters, FilterState, DEFAULT_FILTERS } from "./filters";
import { PrintLayout }    from "./print-layout";
import { ALL_SALES, TODAY, YESTERDAY, SaleRecord } from "./mock-data";
import { exportCSV, exportXLSX, exportPDF, exportPNG, printReport } from "./export-utils";

export default function SalesReports() {
  const [filters, setFilters]     = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const filtered = useMemo((): SaleRecord[] => {
    let data = ALL_SALES;
    if (filters.from)          data = data.filter(s => s.date >= filters.from);
    if (filters.to)            data = data.filter(s => s.date <= filters.to);
    if (filters.branch)        data = data.filter(s => s.branch === filters.branch);
    if (filters.employee)      data = data.filter(s => s.employee === filters.employee);
    if (filters.customer)      data = data.filter(s => s.customer === filters.customer);
    if (filters.paymentMethod) data = data.filter(s => s.paymentMethod === filters.paymentMethod);
    if (filters.product)       data = data.filter(s => s.product === filters.product);
    return data;
  }, [filters, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const todaySales     = ALL_SALES.filter(s => s.date === TODAY);
  const yesterdaySales = ALL_SALES.filter(s => s.date === YESTERDAY);

  const period = filters.from && filters.to
    ? `${filters.from} — ${filters.to}`
    : filters.from ? `من ${filters.from}` : filters.to ? `حتى ${filters.to}` : "كل الفترات";

  const totals = useMemo(() => {
    const done = filtered.filter(s => s.status === "done");
    return {
      sales:  done.reduce((a, s) => a + s.total, 0),
      profit: done.reduce((a, s) => a + s.profit, 0),
      count:  done.length,
    };
  }, [filtered]);

  return (
    <div className="space-y-7" key={refreshKey}>

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            لوحة تقارير المبيعات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date("2026-06-25").toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            &nbsp;·&nbsp;{filtered.length} سجل
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setShowFilters(f => !f)}
            className="gap-1.5"
          >
            🔍 {showFilters ? "إخفاء الفلاتر" : "الفلاتر"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => printReport("print-area")} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />طباعة
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportPDF(filtered, period, totals)} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" />PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportXLSX(filtered)} className="gap-1.5">
            <Sheet className="h-3.5 w-3.5" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportPNG("print-area")} className="gap-1.5">
            <Image className="h-3.5 w-3.5" />PNG
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── Filters (collapsible) ── */}
      {showFilters && (
        <ReportFilters
          filters={filters}
          onChange={f => setFilters(f)}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />
      )}

      {/* ── Section 1: KPI Cards ── */}
      <KpiCards today={todaySales} yesterday={yesterdaySales} />

      {/* ── Section 2: Trend Chart ── */}
      <TrendChart sales={filtered} />

      {/* ── Section 3: 2×2 Insight Grid ── */}
      <InsightGrid sales={filtered} />

      {/* ── Section 4: Smart / Live Cards ── */}
      <SmartCards allSales={ALL_SALES} />

      {/* ── Section 5: Recent Invoices ── */}
      <RecentInvoices sales={filtered} />

      {/* ── Hidden print layout ── */}
      <div className="hidden">
        <PrintLayout sales={filtered} period={period} />
      </div>
    </div>
  );
}
