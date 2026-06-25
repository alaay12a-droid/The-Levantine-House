import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { SaleRecord, PAYMENT_LABELS, STATUS_LABELS } from "./mock-data";

function sarFmt(halalas: number) {
  return (halalas / 100).toFixed(2) + " ر.س";
}

function rows(sales: SaleRecord[]) {
  return sales.map(s => [
    s.invoiceNo,
    s.date,
    s.customer,
    s.employee,
    s.branch,
    PAYMENT_LABELS[s.paymentMethod],
    sarFmt(s.total),
    sarFmt(s.profit),
    STATUS_LABELS[s.status],
  ]);
}

export function exportCSV(sales: SaleRecord[], filename = "تقارير-المبيعات") {
  const headers = ["رقم الفاتورة","التاريخ","العميل","الموظف","الفرع","طريقة الدفع","إجمالي الفاتورة","الربح","الحالة"];
  const content = [headers, ...rows(sales)].map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
}

export function exportXLSX(sales: SaleRecord[], filename = "تقارير-المبيعات") {
  const headers = ["رقم الفاتورة","التاريخ","العميل","الموظف","الفرع","طريقة الدفع","إجمالي الفاتورة","الربح","الحالة"];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows(sales)]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المبيعات");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPDF(
  sales: SaleRecord[],
  period: string,
  totals: { sales: number; profit: number; count: number },
  filename = "تقارير-المبيعات"
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica");

  doc.setFontSize(18);
  doc.text("روابي المندي للمذاق فن وأصول", 200, 18, { align: "right" });
  doc.setFontSize(11);
  doc.text("تقرير المبيعات", 200, 26, { align: "right" });
  doc.text(`الفترة: ${period}`, 200, 33, { align: "right" });
  doc.text(`تاريخ الطباعة: ${new Date().toLocaleDateString("ar-SA")}`, 200, 40, { align: "right" });

  doc.setFontSize(10);
  doc.text(`إجمالي المبيعات: ${sarFmt(totals.sales)}   |   إجمالي الأرباح: ${sarFmt(totals.profit)}   |   عدد الفواتير: ${totals.count}`, 200, 48, { align: "right" });

  autoTable(doc, {
    startY: 55,
    head: [["رقم الفاتورة","التاريخ","العميل","الموظف","الفرع","الدفع","الإجمالي","الربح","الحالة"]],
    body: rows(sales),
    styles: { font: "helvetica", fontSize: 8, halign: "right" },
    headStyles: { fillColor: [12, 72, 171], halign: "right" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`صفحة ${i} من ${pageCount}`, 148, 205, { align: "center" });
  }

  doc.save(`${filename}.pdf`);
}

export async function exportPNG(elementId: string, filename = "تقرير-المبيعات") {
  const el = document.getElementById(elementId);
  if (!el) return;
  const canvas = await html2canvas(el, { scale: 2, useCORS: true });
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `${filename}.png`;
  a.click();
}

export function printReport(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <html dir="rtl"><head>
    <meta charset="utf-8"/>
    <title>تقرير المبيعات - روابي المندي</title>
    <style>
      * { font-family: 'Cairo', Arial, sans-serif; box-sizing: border-box; }
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
      body { margin: 20mm; font-size: 12px; direction: rtl; text-align: right; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th { background: #0c48ab; color: white; padding: 6px 8px; }
      td { border: 1px solid #ddd; padding: 5px 8px; }
      tr:nth-child(even) td { background: #f5f7fa; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .meta { color: #555; font-size: 11px; margin-bottom: 12px; }
      .summary { display: flex; gap: 24px; margin-bottom: 16px; background: #f0f4ff; padding: 10px; border-radius: 8px; }
      .summary div { font-weight: 600; }
      .summary span { font-weight: 400; color: #444; display: block; font-size: 10px; }
      @media print { body { margin: 10mm; } }
    </style></head><body>
    ${el.innerHTML}
    <p style="margin-top:40px;border-top:1px solid #ccc;padding-top:12px;color:#777;font-size:10px">
    توقيع المدير: ______________________ &nbsp;&nbsp;&nbsp; التاريخ: ${new Date().toLocaleDateString("ar-SA")}
    </p>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
}
