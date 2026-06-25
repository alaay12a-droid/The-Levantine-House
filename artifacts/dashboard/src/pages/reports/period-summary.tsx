import { RevenueAggregate } from "@workspace/api-client-react";
import { sarShort } from "./utils";

interface Props {
  week:  RevenueAggregate | undefined;
  month: RevenueAggregate | undefined;
  year:  RevenueAggregate | undefined;
  loading: boolean;
}

function PeriodCard({ label, icon, data, color }: {
  label: string; icon: string; data: RevenueAggregate | undefined; color: string;
}) {
  return (
    <div className={`rounded-xl border p-5 print:p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl print:text-base">{icon}</span>
        <h3 className="font-bold text-sm">{label}</h3>
      </div>
      <div className="space-y-2.5 text-sm print:text-[11px] print:space-y-1.5">
        {[
          { label: "إجمالي المبيعات",  val: sarShort(data?.totalRevenue ?? 0) },
          { label: "صافي الإيرادات",   val: sarShort(data?.netRevenue    ?? 0) },
          { label: "عدد الفواتير",      val: String(data?.orderCount ?? 0) },
          { label: "متوسط الفاتورة",   val: data && data.orderCount > 0 ? sarShort(data.totalRevenue / data.orderCount) : "—" },
          { label: "ضريبة 15%",        val: sarShort(data?.taxAmount     ?? 0) },
          { label: "طلبات ملغاة",      val: String(data?.cancelledCount ?? 0) },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-semibold">{row.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PeriodSummary({ week, month, year, loading }: Props) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3 print:grid-cols-3">
        {[1,2,3].map(i => <div key={i} className="rounded-xl border bg-muted/30 h-52 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-bold mb-3 flex items-center gap-2 print:text-xs">
        <span>📅</span> مقارنة الفترات
      </h2>
      <div className="grid gap-4 md:grid-cols-3 print:grid-cols-3 print:gap-2">
        <PeriodCard label="هذا الأسبوع"  icon="📅" data={week}  color="bg-blue-50/50 border-blue-200"   />
        <PeriodCard label="هذا الشهر"    icon="📆" data={month} color="bg-indigo-50/50 border-indigo-200" />
        <PeriodCard label="هذا العام"    icon="🗓️" data={year}  color="bg-violet-50/50 border-violet-200" />
      </div>
    </div>
  );
}
