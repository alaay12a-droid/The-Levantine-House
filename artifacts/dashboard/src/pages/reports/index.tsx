import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Printer, FileDown, Sheet, FileText, Image, RefreshCw, BarChart2 } from "lucide-react";
import { StatsCards } from "./stats-cards";
import { ReportFilters, FilterState, DEFAULT_FILTERS } from "./filters";
import { SalesCharts } from "./charts";
import { SubReports } from "./sub-reports";
import { SalesTable } from "./sales-table";
import { PrintLayout } from "./print-layout";
import { ALL_SALES, SaleRecord } from "./mock-data";
import { exportCSV, exportXLSX, exportPDF, exportPNG, printReport } from "./export-utils";

export default function SalesReports() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const filtered = useMemo(() => {
    let data: SaleRecord[] = ALL_SALES;
    if (filters.from) data = data.filter(s => s.date >= filters.from);
    if (filters.to)   data = data.filter(s => s.date <= filters.to);
    if (filters.branch)        data = data.filter(s => s.branch === filters.branch);
    if (filters.employee)      data = data.filter(s => s.employee === filters.employee);
    if (filters.customer)      data = data.filter(s => s.customer === filters.customer);
    if (filters.paymentMethod) data = data.filter(s => s.paymentMethod === filters.paymentMethod);
    if (filters.product)       data = data.filter(s => s.product === filters.product);
    return data;
  }, [filters, refreshKey]);

  const exportData = selectedIds.size > 0
    ? filtered.filter(s => selectedIds.has(s.id))
    : filtered;

  const period = filters.from && filters.to
    ? `${filters.from} — ${filters.to}`
    : filters.from ? `من ${filters.from}` : filters.to ? `حتى ${filters.to}` : "كل الفترات";

  const totals = useMemo(() => {
    const done = exportData.filter(s => s.status === "done");
    return {
      sales: done.reduce((a, s) => a + s.total, 0),
      profit: done.reduce((a, s) => a + s.profit, 0),
      count: done.length,
    };
  }, [exportData]);

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            تقارير المبيعات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} سجل • {period}
            {selectedIds.size > 0 && ` • ${selectedIds.size} محدد`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => printReport("print-area")} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />طباعة
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => exportPDF(exportData, period, totals)} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" />PDF
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => exportXLSX(exportData)} className="gap-1.5">
            <Sheet className="h-3.5 w-3.5" />Excel
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => exportCSV(exportData)} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />CSV
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => exportPNG("print-area")} className="gap-1.5">
            <Image className="h-3.5 w-3.5" />PNG
          </Button>
        </div>
      </div>

      <Separator />

      {/* Filters */}
      <ReportFilters
        filters={filters}
        onChange={f => { setFilters(f); setSelectedIds(new Set()); }}
        onReset={() => { setFilters(DEFAULT_FILTERS); setSelectedIds(new Set()); }}
      />

      {/* Stats */}
      <StatsCards sales={filtered} />

      {/* Charts */}
      <SalesCharts sales={filtered} />

      {/* Sub-reports tabs */}
      <SubReports sales={filtered} />

      {/* Main table */}
      <SalesTable sales={filtered} selectedIds={selectedIds} onSelect={setSelectedIds} />

      {/* Hidden print layout */}
      <div className="hidden">
        <PrintLayout sales={exportData} period={period} />
      </div>
    </div>
  );
}
