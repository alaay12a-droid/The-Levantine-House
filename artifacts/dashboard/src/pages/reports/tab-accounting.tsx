import { useState, useMemo } from "react";
import { RevenueAggregate } from "@workspace/api-client-react";
import { Order } from "@workspace/api-client-react";
import { sarShort, sar, filterToday } from "./utils";

interface Props {
  today:    RevenueAggregate | undefined;
  week:     RevenueAggregate | undefined;
  month:    RevenueAggregate | undefined;
  year:     RevenueAggregate | undefined;
  orders:   Order[];
  loading:  boolean;
}

interface ValidationResult {
  ok:            boolean;
  computed:      number;
  reported:      number;
  diff:          number;
  ordersChecked: number;
}

export function TabAccounting({ today, week, month, year, orders, loading }: Props) {
  const [cashInput, setCashInput]   = useState("");
  const [showReconcile, setShowReconcile] = useState(false);

  // ── Day-closing validation ─────────────────────────────────────────
  const validation = useMemo<ValidationResult>(() => {
    const todayOrders = filterToday(orders);
    const done = todayOrders.filter(o => o.status === "done");
    const computed = done.reduce((a, o) => a + o.totalPrice / 100, 0);
    const reported = today?.totalRevenue ?? 0;
    const diff     = +(Math.abs(computed - reported)).toFixed(2);
    return { ok: diff < 0.5, computed: +computed.toFixed(2), reported, diff, ordersChecked: done.length };
  }, [orders, today]);

  // ── Cash register reconciliation ──────────────────────────────────
  const expectedCash = today?.cashRevenue ?? 0;
  const actualCash   = parseFloat(cashInput) || 0;
  const cashDiff     = +(actualCash - expectedCash).toFixed(2);
  const hasCashInput = cashInput.trim() !== "" && !isNaN(parseFloat(cashInput));

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl border bg-muted/30 animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-8">

      {/* ── Revenue breakdown ── */}
      <div className="grid gap-5 md:grid-cols-2">
        {[
          { label: "اليوم",       data: today, color: "border-emerald-200 bg-emerald-50" },
          { label: "هذا الأسبوع", data: week,  color: "border-blue-200 bg-blue-50"     },
          { label: "هذا الشهر",   data: month, color: "border-indigo-200 bg-indigo-50"  },
          { label: "هذا العام",   data: year,  color: "border-violet-200 bg-violet-50"  },
        ].map(({ label, data, color }) => (
          <section key={label} className={`rounded-2xl border ${color} p-5 print:p-3`}>
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <span>📊</span> ملخص الإيرادات — {label}
            </h3>
            <div className="space-y-2.5 text-sm">
              {[
                { label: "إجمالي الفواتير",           val: sarShort(data?.totalRevenue ?? 0),    strong: true  },
                { label: "إيرادات التوصيل",           val: sarShort(data?.deliveryRevenue ?? 0)               },
                { label: "إيرادات الأصناف",           val: sarShort(data?.itemsRevenue ?? 0)                  },
                { label: "ضريبة القيمة المضافة 15%",  val: sarShort(data?.taxAmount ?? 0)                     },
                { label: "صافي الإيرادات*",           val: sarShort(data?.netRevenue ?? 0),      strong: true  },
                { label: "مبيعات نقدي",               val: sarShort(data?.cashRevenue ?? 0)                   },
                { label: "مبيعات إلكتروني",           val: sarShort(data?.onlineRevenue ?? 0)                 },
                { label: "قيمة الملغاة",              val: sarShort(data?.cancelledValue ?? 0), warn: true     },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between border-b border-black/5 pb-2 last:border-0">
                  <span className={`text-xs ${row.warn ? "text-red-600" : "text-muted-foreground"}`}>{row.label}</span>
                  <span className={`font-medium text-xs ${row.strong ? "font-bold text-base" : ""} ${row.warn ? "text-red-600" : ""}`}>
                    {row.val}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              * صافي الإيرادات = الإجمالي − ضريبة 15% (لا يشمل تكلفة الأصناف)
            </p>
          </section>
        ))}
      </div>

      {/* ── Day Closing Validation ── */}
      <section className={`rounded-2xl border p-5 print:p-3 ${validation.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          <span>{validation.ok ? "✅" : "⚠️"}</span>
          مطابقة إغلاق اليومية
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">المحسوب من الفواتير</p>
            <p className="text-xl font-bold">{sar(validation.computed)}</p>
            <p className="text-[10px] text-muted-foreground">{validation.ordersChecked} فاتورة مكتملة</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">المُبلَّغ في نظام الإيرادات</p>
            <p className="text-xl font-bold">{sar(validation.reported)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">الفرق</p>
            <p className={`text-xl font-bold ${validation.ok ? "text-emerald-700" : "text-red-600"}`}>
              {sar(validation.diff)}
            </p>
          </div>
        </div>
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${validation.ok
          ? "bg-emerald-100 text-emerald-800"
          : "bg-red-100 text-red-700"
        }`}>
          {validation.ok
            ? "✅ الحسابات متطابقة — لا يوجد فرق في الأرقام"
            : `⚠️ تحذير: يوجد فرق ${sar(validation.diff)} بين مجموع الفواتير وتقرير الإيرادات — يُنصح بمراجعة الطلبات`
          }
        </div>
      </section>

      {/* ── Cash Register Reconciliation ── */}
      <section className="rounded-2xl border bg-card p-5 print:p-3">
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          <span>💵</span> مطابقة الصندوق النقدي اليوم
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/30 border p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الكاش المتوقع (من الطلبات)</span>
                <span className="font-bold text-emerald-700">{sar(expectedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">عدد فواتير نقدي</span>
                <span className="font-medium">{today?.cashCount ?? 0}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                أدخل الكاش الفعلي في الصندوق (ر.س)
              </label>
              <input
                type="number"
                step="0.01"
                value={cashInput}
                onChange={e => setCashInput(e.target.value)}
                placeholder="مثال: 1250.50"
                className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            {hasCashInput ? (
              <div className={`rounded-2xl border p-5 text-center ${cashDiff === 0 ? "border-emerald-200 bg-emerald-50" : cashDiff > 0 ? "border-blue-200 bg-blue-50" : "border-red-200 bg-red-50"}`}>
                <p className="text-xs text-muted-foreground mb-2">نتيجة المطابقة</p>
                <p className={`text-3xl font-bold mb-2 ${cashDiff === 0 ? "text-emerald-700" : cashDiff > 0 ? "text-blue-700" : "text-red-600"}`}>
                  {cashDiff >= 0 ? "+" : ""}{sar(cashDiff)}
                </p>
                <p className={`text-sm font-semibold ${cashDiff === 0 ? "text-emerald-700" : cashDiff > 0 ? "text-blue-700" : "text-red-600"}`}>
                  {cashDiff === 0 ? "✅ الصندوق مطابق تماماً"
                    : cashDiff > 0 ? "📈 زيادة في الصندوق"
                    : "📉 عجز في الصندوق"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  الفعلي: {sar(actualCash)} · المتوقع: {sar(expectedCash)}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
                <p className="text-3xl mb-2">💵</p>
                <p className="text-sm">أدخل الكاش الفعلي لحساب الفرق</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Not available ── */}
      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 print:hidden">
        <h3 className="font-bold text-sm mb-3 text-gray-600 flex items-center gap-2">
          <span>🚫</span> بيانات محاسبية غير متوفرة في قاعدة البيانات الحالية
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: "💸", label: "إجمالي المصروفات", note: "يتطلب إضافة جدول expenses للنظام" },
            { icon: "📊", label: "صافي الربح الحقيقي", note: "يتطلب تكلفة كل صنف (COGS)" },
            { icon: "↩️", label: "المرتجعات", note: "لا يوجد جدول returns — فقط إلغاء الطلبات" },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{item.icon}</span>
                <span className="font-semibold text-sm text-gray-500">{item.label}</span>
              </div>
              <p className="text-xs text-gray-400">{item.note}</p>
              <p className="text-lg font-bold text-gray-300 mt-2">— غير متوفر</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
