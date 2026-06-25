import { ItemStat, sar } from "./utils";

interface Props { items: ItemStat[]; loading: boolean; }

export function TodayItems({ items, loading }: Props) {
  const totalQty = items.reduce((a, i) => a + i.qty, 0);
  const totalRev = items.reduce((a, i) => a + i.total, 0);

  return (
    <section className="rounded-xl border bg-card shadow-sm overflow-hidden print:shadow-none print:border-gray-300">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-amber-50/60 print:bg-amber-50 print:py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍽️</span>
          <h2 className="font-bold text-base print:text-sm">الأصناف المباعة اليوم</h2>
        </div>
        {!loading && items.length > 0 && (
          <span className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full print:text-[10px]">
            {items.length} صنف · {totalQty} قطعة
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-9 w-full bg-muted/40 rounded animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <span className="text-3xl">🍽️</span>
          <p className="font-medium text-sm">لا توجد أصناف مباعة اليوم</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm print:text-[11px]">
            <thead>
              <tr className="border-b bg-muted/30 text-right">
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground">#</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground">اسم الصنف</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-center">الكمية</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground">سعر الوحدة</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground">الإجمالي</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-center">%</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const pct = totalRev > 0 ? (item.total / totalRev) * 100 : 0;
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors print:border-gray-200">
                    <td className="py-2.5 px-4 text-muted-foreground font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-medium">{item.name}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center h-6 min-w-[28px] rounded-full bg-amber-100 text-amber-800 font-bold text-xs print:bg-transparent print:text-black">
                        {item.qty}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{sar(item.unitPrice)}</td>
                    <td className="py-2.5 px-4 font-bold text-emerald-700">{sar(item.total)}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden print:hidden">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-amber-50/50 print:bg-amber-50">
                <td className="py-2.5 px-4" colSpan={2}>
                  <span className="font-bold text-sm">الإجمالي</span>
                </td>
                <td className="py-2.5 px-4 text-center font-bold text-amber-700">{totalQty}</td>
                <td />
                <td className="py-2.5 px-4 font-bold text-emerald-700">{sar(totalRev)}</td>
                <td className="py-2.5 px-4 text-center text-xs text-muted-foreground">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
