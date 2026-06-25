import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SaleRecord, PAYMENT_LABELS, STATUS_LABELS } from "./mock-data";
import { ChevronUp, ChevronDown, ChevronsUpDown, Columns, Search } from "lucide-react";

function sar(h: number) { return (h / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2 }) + " ر.س"; }

const STATUS_COLORS: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
  returned: "bg-orange-100 text-orange-700",
};

type Column = { key: keyof SaleRecord | "actions"; label: string; visible: boolean };
type SortDir = "asc" | "desc" | null;

const DEFAULT_COLS: Column[] = [
  { key: "invoiceNo",     label: "رقم الفاتورة",   visible: true  },
  { key: "date",          label: "التاريخ",         visible: true  },
  { key: "customer",      label: "العميل",          visible: true  },
  { key: "employee",      label: "الموظف",          visible: true  },
  { key: "branch",        label: "الفرع",           visible: false },
  { key: "paymentMethod", label: "طريقة الدفع",    visible: true  },
  { key: "total",         label: "إجمالي الفاتورة", visible: true  },
  { key: "profit",        label: "الربح",           visible: true  },
  { key: "status",        label: "الحالة",          visible: true  },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface Props { sales: SaleRecord[]; selectedIds: Set<string>; onSelect: (ids: Set<string>) => void; }

export function SalesTable({ sales, selectedIds, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof SaleRecord>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLS);

  const visible = columns.filter(c => c.visible);

  function toggleSort(key: keyof SaleRecord) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : d === "desc" ? null : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ k }: { k: keyof SaleRecord }) {
    if (sortKey !== k) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
    if (sortDir === "asc") return <ChevronUp className="h-3 w-3 text-primary" />;
    if (sortDir === "desc") return <ChevronDown className="h-3 w-3 text-primary" />;
    return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sales.filter(s =>
      !q || s.invoiceNo.toLowerCase().includes(q) || s.customer.toLowerCase().includes(q) ||
      s.employee.toLowerCase().includes(q) || s.branch.toLowerCase().includes(q)
    );
  }, [sales, search]);

  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv), "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const allIds = paged.map(s => s.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));

  function toggleAll() {
    const next = new Set(selectedIds);
    if (allSelected) allIds.forEach(id => next.delete(id));
    else allIds.forEach(id => next.add(id));
    onSelect(next);
  }

  function toggleRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelect(next);
  }

  function cellValue(s: SaleRecord, key: keyof SaleRecord) {
    if (key === "total") return sar(s.total);
    if (key === "profit") return <span className="text-emerald-600 font-semibold">{sar(s.profit)}</span>;
    if (key === "paymentMethod") return PAYMENT_LABELS[s.paymentMethod];
    if (key === "status") return (
      <Badge className={`${STATUS_COLORS[s.status]} border-0 text-xs`}>
        {STATUS_LABELS[s.status]}
      </Badge>
    );
    return String(s[key]);
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            جدول الفواتير
            <span className="mr-2 text-sm font-normal text-muted-foreground">({sorted.length} فاتورة)</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث..." className="h-9 pr-8 w-48" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9">
                  <Columns className="h-4 w-4" />الأعمدة
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {columns.map(col => (
                  <DropdownMenuCheckboxItem
                    key={String(col.key)}
                    checked={col.visible}
                    onCheckedChange={v => setColumns(cols => cols.map(c => c.key === col.key ? { ...c, visible: v } : c))}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <p className="text-xs text-primary font-medium">{selectedIds.size} صف محدد</p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-y">
              <tr>
                <th className="w-10 py-3 px-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                {visible.map(col => (
                  <th
                    key={String(col.key)}
                    className="py-3 px-3 text-right font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                    onClick={() => toggleSort(col.key as keyof SaleRecord)}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {col.label}
                      <SortIcon k={col.key as keyof SaleRecord} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={visible.length + 1} className="py-12 text-center text-muted-foreground">لا توجد نتائج</td></tr>
              ) : paged.map((s, idx) => (
                <tr
                  key={s.id}
                  className={`border-b transition-colors hover:bg-muted/30 ${selectedIds.has(s.id) ? "bg-primary/5" : idx % 2 === 1 ? "bg-muted/10" : ""}`}
                >
                  <td className="py-3 px-3">
                    <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleRow(s.id)} />
                  </td>
                  {visible.map(col => (
                    <td key={String(col.key)} className="py-3 px-3 whitespace-nowrap">
                      {cellValue(s, col.key as keyof SaleRecord)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>عرض</span>
            <select
              className="border rounded px-2 py-1 text-sm bg-background"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>لكل صفحة — صفحة {page} من {totalPages || 1}</span>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(1)}>«</Button>
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              if (p > totalPages) return null;
              return (
                <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => setPage(p)}>{p}</Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)}>›</Button>
            <Button variant="outline" size="sm" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(totalPages)}>»</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
