import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import { BRANCHES_LIST, EMPLOYEES_LIST, CUSTOMERS_LIST, PRODUCTS_LIST, PAYMENT_LABELS, PaymentMethod } from "./mock-data";

export interface FilterState {
  from: string; to: string;
  branch: string; employee: string;
  customer: string; paymentMethod: string;
  product: string; quickRange: string;
}

export const DEFAULT_FILTERS: FilterState = {
  from: "", to: "", branch: "", employee: "",
  customer: "", paymentMethod: "", product: "", quickRange: "",
};

interface Props { filters: FilterState; onChange: (f: FilterState) => void; onReset: () => void; }

const ALL = "__all__";

export function ReportFilters({ filters, onChange, onReset }: Props) {
  const set = (k: keyof FilterState) => (v: string) => {
    const next: FilterState = { ...filters, [k]: v === ALL ? "" : v };
    if (k === "quickRange") {
      const now = new Date("2026-06-25");
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      if (v === "today") { next.from = next.to = fmt(now); }
      else if (v === "week") {
        const s = new Date(now); s.setDate(s.getDate() - 6);
        next.from = fmt(s); next.to = fmt(now);
      } else if (v === "month") {
        next.from = fmt(now).slice(0, 7) + "-01"; next.to = fmt(now);
      } else if (v === "year") {
        next.from = fmt(now).slice(0, 4) + "-01-01"; next.to = fmt(now);
      } else { next.from = ""; next.to = ""; }
    }
    onChange(next);
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">فلاتر التقرير</h3>
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-2 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />إعادة تعيين
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">الفترة السريعة</Label>
          <Select value={filters.quickRange || ALL} onValueChange={set("quickRange")}>
            <SelectTrigger className="h-9"><SelectValue placeholder="اختر فترة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل الفترات</SelectItem>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="week">هذا الأسبوع</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="year">هذا العام</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">من تاريخ</Label>
          <Input type="date" className="h-9" value={filters.from} onChange={e => set("from")(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">إلى تاريخ</Label>
          <Input type="date" className="h-9" value={filters.to} onChange={e => set("to")(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">الفرع</Label>
          <Select value={filters.branch || ALL} onValueChange={set("branch")}>
            <SelectTrigger className="h-9"><SelectValue placeholder="كل الفروع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل الفروع</SelectItem>
              {BRANCHES_LIST.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">الموظف</Label>
          <Select value={filters.employee || ALL} onValueChange={set("employee")}>
            <SelectTrigger className="h-9"><SelectValue placeholder="كل الموظفين" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل الموظفين</SelectItem>
              {EMPLOYEES_LIST.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">العميل</Label>
          <Select value={filters.customer || ALL} onValueChange={set("customer")}>
            <SelectTrigger className="h-9"><SelectValue placeholder="كل العملاء" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل العملاء</SelectItem>
              {CUSTOMERS_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">طريقة الدفع</Label>
          <Select value={filters.paymentMethod || ALL} onValueChange={set("paymentMethod")}>
            <SelectTrigger className="h-9"><SelectValue placeholder="كل الطرق" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل الطرق</SelectItem>
              {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">المنتج</Label>
          <Select value={filters.product || ALL} onValueChange={set("product")}>
            <SelectTrigger className="h-9"><SelectValue placeholder="كل المنتجات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل المنتجات</SelectItem>
              {PRODUCTS_LIST.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
