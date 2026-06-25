export type PaymentMethod = "cash" | "card" | "transfer" | "online";
export type OrderStatus = "done" | "pending" | "cancelled" | "returned";

export interface SaleRecord {
  id: string;
  invoiceNo: string;
  date: string;
  customer: string;
  employee: string;
  branch: string;
  paymentMethod: PaymentMethod;
  total: number;
  profit: number;
  status: OrderStatus;
  product: string;
  quantity: number;
}

export interface DailySale { date: string; sales: number; profit: number; }
export interface MonthlySale { month: string; sales: number; profit: number; }
export interface YearlySale { year: string; sales: number; profit: number; }

const CUSTOMERS = ["أحمد محمد","فهد العتيبي","سعد الغامدي","خالد الزهراني","محمد السلمي","علي الحربي","عبدالله القحطاني","يوسف الشمري","تركي الدوسري","ناصر العنزي","حمد الرشيدي","سلطان المطيري","بدر الرويلي","وليد الجهني","عمر الحلبي"];
const EMPLOYEES = ["سارة أحمد","نورا محمد","ريم علي","هند سالم","منى خالد","لمى فهد","دانة عمر","رنا يوسف","جنى حسن","وفاء ناصر"];
const BRANCHES = ["الفرع الرئيسي","فرع الروضة","فرع النزهة","فرع الشرق"];
const PRODUCTS = ["مندي دجاج حبة كاملة","مندي لحم كيلو","مشوي مخلوط","مقبلات متنوعة","رز مندي","عصير برتقال","عصير مانجو","ببسي","ماء معدني","سلطة خضراء","مندي دجاج نصف","مندي لحم نصف كيلو","مشاوي دجاج","كبسة دجاج","كبسة لحم"];
const PAYMENT_METHODS: PaymentMethod[] = ["cash","card","transfer","online"];
const STATUSES: OrderStatus[] = ["done","done","done","done","pending","returned","cancelled"];

function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]) { return arr[rnd(0, arr.length - 1)]; }

let seed = 42;
function seededRnd(min: number, max: number): number {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return min + (Math.abs(seed) % (max - min + 1));
}
function seededPick<T>(arr: T[]) { return arr[seededRnd(0, arr.length - 1)]; }

export function generateMockSales(count = 200): SaleRecord[] {
  seed = 42;
  const records: SaleRecord[] = [];
  const now = new Date("2026-06-25");
  for (let i = 0; i < count; i++) {
    const daysAgo = seededRnd(0, 365);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const total = seededRnd(25, 450) * 100;
    const profitPct = 0.25 + seededRnd(0, 20) / 100;
    const status = seededPick(STATUSES);
    records.push({
      id: String(i + 1),
      invoiceNo: `INV-${String(1000 + i).padStart(4,"0")}`,
      date: d.toISOString().split("T")[0],
      customer: seededPick(CUSTOMERS),
      employee: seededPick(EMPLOYEES),
      branch: seededPick(BRANCHES),
      paymentMethod: seededPick(PAYMENT_METHODS),
      total,
      profit: Math.floor(total * profitPct),
      status,
      product: seededPick(PRODUCTS),
      quantity: seededRnd(1, 5),
    });
  }
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export const ALL_SALES = generateMockSales(200);

export function buildDailySales(sales: SaleRecord[]): DailySale[] {
  const map: Record<string, { sales: number; profit: number }> = {};
  for (const s of sales) {
    if (s.status === "cancelled" || s.status === "returned") continue;
    if (!map[s.date]) map[s.date] = { sales: 0, profit: 0 };
    map[s.date].sales += s.total;
    map[s.date].profit += s.profit;
  }
  return Object.entries(map)
    .sort(([a],[b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, v]) => ({ date: date.slice(5), ...v }));
}

export function buildMonthlySales(sales: SaleRecord[]): MonthlySale[] {
  const map: Record<string, { sales: number; profit: number }> = {};
  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  for (const s of sales) {
    if (s.status === "cancelled" || s.status === "returned") continue;
    const key = s.date.slice(0, 7);
    if (!map[key]) map[key] = { sales: 0, profit: 0 };
    map[key].sales += s.total;
    map[key].profit += s.profit;
  }
  return Object.entries(map)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k, v]) => ({ month: monthNames[parseInt(k.slice(5,7)) - 1] + " " + k.slice(0,4), ...v }));
}

export function buildYearlySales(sales: SaleRecord[]): YearlySale[] {
  const map: Record<string, { sales: number; profit: number }> = {};
  for (const s of sales) {
    if (s.status === "cancelled" || s.status === "returned") continue;
    const key = s.date.slice(0, 4);
    if (!map[key]) map[key] = { sales: 0, profit: 0 };
    map[key].sales += s.total;
    map[key].profit += s.profit;
  }
  return Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
    .map(([year, v]) => ({ year, ...v }));
}

export function topBy<K extends keyof SaleRecord>(sales: SaleRecord[], key: K, n = 10) {
  const map: Record<string, { sales: number; profit: number; count: number }> = {};
  for (const s of sales) {
    if (s.status === "cancelled" || s.status === "returned") continue;
    const k = String(s[key]);
    if (!map[k]) map[k] = { sales: 0, profit: 0, count: 0 };
    map[k].sales += s.total;
    map[k].profit += s.profit;
    map[k].count++;
  }
  return Object.entries(map)
    .sort(([,a],[,b]) => b.sales - a.sales)
    .slice(0, n)
    .map(([name, v]) => ({ name, ...v }));
}

export function paymentBreakdown(sales: SaleRecord[]) {
  const map: Record<string, number> = {};
  for (const s of sales) {
    if (s.status === "cancelled" || s.status === "returned") continue;
    map[s.paymentMethod] = (map[s.paymentMethod] ?? 0) + s.total;
  }
  const labels: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل", online: "إلكتروني" };
  return Object.entries(map).map(([k, v]) => ({ name: labels[k] ?? k, value: v }));
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "نقدي", card: "بطاقة", transfer: "تحويل", online: "إلكتروني"
};
export const STATUS_LABELS: Record<OrderStatus, string> = {
  done: "مكتمل", pending: "معلق", cancelled: "ملغي", returned: "مرتجع"
};

export const BRANCHES_LIST = BRANCHES;
export const EMPLOYEES_LIST = EMPLOYEES;
export const CUSTOMERS_LIST = CUSTOMERS;
export const PRODUCTS_LIST = PRODUCTS;
