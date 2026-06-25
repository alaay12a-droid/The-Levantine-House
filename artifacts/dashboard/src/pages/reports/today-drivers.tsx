import { sarShort, sar } from "./utils";

interface DriverOrder {
  orderId: number;
  dailyNumber: number | null;
  customerName: string;
  totalPrice: number;
  deliveredAt: string | null;
}
interface DriverSummary {
  driver: { id: number; name: string; phone: string; photoUrl: string | null; active: boolean };
  ordersCount: number;
  totalCollected: number;
  orders: DriverOrder[];
}

interface Props { summaries: DriverSummary[] | undefined; loading: boolean; }

export function TodayDrivers({ summaries, loading }: Props) {
  const active = summaries?.filter(s => s.ordersCount > 0) ?? [];
  const total  = active.reduce((a, s) => a + s.totalCollected, 0);
  const totalOrders = active.reduce((a, s) => a + s.ordersCount, 0);

  return (
    <section className="rounded-xl border bg-card shadow-sm overflow-hidden print:shadow-none print:border-gray-300">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-violet-50/60 print:bg-violet-50 print:py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛵</span>
          <h2 className="font-bold text-base print:text-sm">إحصائيات المندوبين اليوم</h2>
        </div>
        {!loading && active.length > 0 && (
          <span className="text-xs text-violet-700 font-semibold bg-violet-100 border border-violet-200 px-2.5 py-0.5 rounded-full print:text-[10px]">
            {active.length} مندوب · {totalOrders} توصيل
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 w-full bg-muted/40 rounded animate-pulse" />)}
        </div>
      ) : !summaries?.length ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
          <span className="text-3xl">🛵</span>
          <p className="font-medium text-sm">لا يوجد مندوبون مسجلون</p>
        </div>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
          <span className="text-3xl">💤</span>
          <p className="font-medium text-sm">لا توجد توصيلات مكتملة اليوم</p>
          <p className="text-xs">({summaries.length} مندوب متاح)</p>
        </div>
      ) : (
        <div>
          {/* Summary row */}
          <div className="px-5 py-3 bg-violet-50/30 border-b grid grid-cols-3 gap-4 text-center print:py-2">
            <div>
              <p className="text-xs text-muted-foreground">مندوبون نشطون اليوم</p>
              <p className="text-lg font-bold text-violet-700 print:text-sm">{active.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي التوصيلات</p>
              <p className="text-lg font-bold text-violet-700 print:text-sm">{totalOrders}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي محصّل</p>
              <p className="text-lg font-bold text-emerald-700 print:text-sm">{sarShort(total)}</p>
            </div>
          </div>

          {/* Driver cards */}
          <div className="divide-y print:divide-gray-200">
            {(summaries ?? []).map(s => (
              <div key={s.driver.id} className="px-5 py-3 hover:bg-muted/20 transition-colors print:py-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {s.driver.photoUrl ? (
                      <img src={s.driver.photoUrl} alt={s.driver.name} className="h-9 w-9 rounded-full object-cover border print:hidden" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center print:hidden">
                        <span className="text-sm font-bold text-violet-700">{s.driver.name.charAt(0)}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-2">
                        {s.driver.name}
                        {!s.driver.active && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">موقوف</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.driver.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">طلبات</p>
                      <p className={`text-lg font-bold print:text-sm ${s.ordersCount > 0 ? "text-violet-700" : "text-muted-foreground"}`}>
                        {s.ordersCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">محصّل</p>
                      <p className={`text-sm font-bold print:text-xs ${s.totalCollected > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {sarShort(s.totalCollected)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mini orders list for this driver */}
                {s.orders.length > 0 && (
                  <div className="mt-2 space-y-1 print:mt-1">
                    {s.orders.map(o => (
                      <div key={o.orderId} className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5 print:bg-gray-50">
                        <span className="font-mono font-semibold text-primary">#{o.dailyNumber}</span>
                        <span className="truncate mx-2">{o.customerName}</span>
                        <span className="font-semibold text-emerald-700 shrink-0">{sar(o.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
