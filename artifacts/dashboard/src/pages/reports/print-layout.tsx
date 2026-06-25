import { SaleRecord } from "./mock-data";

function sar(h: number) { return (h / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2 }) + " ر.س"; }

interface Props {
  sales: SaleRecord[];
  period: string;
}

export function PrintLayout({ sales, period }: Props) {
  const done = sales.filter(s => s.status === "done");
  const totalSales = done.reduce((a, s) => a + s.total, 0);
  const totalProfit = done.reduce((a, s) => a + s.profit, 0);
  const invoiceCount = done.length;

  return (
    <div id="print-area" className="bg-white text-black p-8 font-['Cairo',sans-serif] text-sm" dir="rtl">
      <div className="border-b-2 border-primary pb-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-gray-500">تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA")}</div>
            <div className="text-xs text-gray-500">الفترة: {period}</div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3 justify-end">
              <div>
                <h1 className="text-2xl font-bold text-primary">روابي المندي</h1>
                <p className="text-sm text-gray-500">للمذاق فن وأصول</p>
              </div>
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white text-2xl font-bold">ر</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: "إجمالي المبيعات", value: sar(totalSales), color: "text-blue-700" },
            { label: "إجمالي الأرباح",  value: sar(totalProfit), color: "text-emerald-700" },
            { label: "عدد الفواتير",    value: String(invoiceCount), color: "text-violet-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3 text-center border">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className={`text-lg font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-base font-bold mb-3">تفاصيل الفواتير</h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-primary text-white">
            {["رقم الفاتورة","التاريخ","العميل","الموظف","الفرع","طريقة الدفع","الإجمالي","الربح","الحالة"].map(h => (
              <th key={h} className="py-2 px-2 text-right border border-primary/20">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sales.slice(0, 50).map((s, i) => (
            <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="py-1.5 px-2 border border-gray-200">{s.invoiceNo}</td>
              <td className="py-1.5 px-2 border border-gray-200">{s.date}</td>
              <td className="py-1.5 px-2 border border-gray-200">{s.customer}</td>
              <td className="py-1.5 px-2 border border-gray-200">{s.employee}</td>
              <td className="py-1.5 px-2 border border-gray-200">{s.branch}</td>
              <td className="py-1.5 px-2 border border-gray-200">{{ cash:"نقدي", card:"بطاقة", transfer:"تحويل", online:"إلكتروني" }[s.paymentMethod]}</td>
              <td className="py-1.5 px-2 border border-gray-200 font-semibold">{sar(s.total)}</td>
              <td className="py-1.5 px-2 border border-gray-200 text-emerald-700">{sar(s.profit)}</td>
              <td className="py-1.5 px-2 border border-gray-200">{{ done:"مكتمل", pending:"معلق", cancelled:"ملغي", returned:"مرتجع" }[s.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-10 pt-6 border-t flex justify-between text-xs text-gray-500">
        <div>
          <div className="font-semibold text-gray-700 mb-1">توقيع المدير</div>
          <div className="w-48 border-b border-gray-400 mt-8"></div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-gray-700 mb-1">روابي المندي للمذاق فن وأصول</div>
          <div>تبوك - حي الروضة</div>
          <div>0530707042</div>
        </div>
      </div>
    </div>
  );
}
