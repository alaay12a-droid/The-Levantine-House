import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq, gte, lt, and, sql } from "drizzle-orm";

const router = Router();

// Saudi timezone offset (UTC+3)
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function toLocalMidnight(year: number, month: number, day: number): Date {
  // midnight in Saudi time expressed as UTC
  return new Date(Date.UTC(year, month, day) - TZ_OFFSET_MS);
}

function nowLocal(): Date {
  return new Date(Date.now() + TZ_OFFSET_MS);
}

router.get("/revenue", async (_req, res) => {
  const nl = nowLocal();
  const y = nl.getUTCFullYear();
  const m = nl.getUTCMonth();
  const d = nl.getUTCDate();

  // ── date range boundaries ──
  const todayStart   = toLocalMidnight(y, m, d);
  const tomorrowStart = toLocalMidnight(y, m, d + 1);
  const monthStart   = toLocalMidnight(y, m, 1);
  const nextMonthStart = toLocalMidnight(y, m + 1, 1);
  const yearStart    = toLocalMidnight(y, 0, 1);
  const nextYearStart = toLocalMidnight(y + 1, 0, 1);

  const aggregate = async (from: Date, to: Date) => {
    const rows = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${ordersTable.totalPrice}), 0)`,
        deliveryRevenue: sql<number>`coalesce(sum(${ordersTable.deliveryFee}), 0)`,
        orderCount: sql<number>`count(*)`,
      })
      .from(ordersTable)
      .where(
        and(
          gte(ordersTable.createdAt, from),
          lt(ordersTable.createdAt, to),
          eq(ordersTable.status, "done"),
        )
      );
    const row = rows[0];
    const total = Number(row.totalRevenue) / 100;
    const delivery = Number(row.deliveryRevenue) / 100;
    return {
      totalRevenue: total,
      deliveryRevenue: delivery,
      itemsRevenue: +(total - delivery).toFixed(2),
      orderCount: Number(row.orderCount),
    };
  };

  // daily breakdown for current month (last 30 days)
  const dailyBreakdown: { date: string; total: number; delivery: number; items: number; orders: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dayLocal = new Date(nl.getTime() - i * 86400000);
    const dy = dayLocal.getUTCFullYear();
    const dm = dayLocal.getUTCMonth();
    const dd = dayLocal.getUTCDate();
    const from = toLocalMidnight(dy, dm, dd);
    const to   = toLocalMidnight(dy, dm, dd + 1);
    const r = await aggregate(from, to);
    const label = `${String(dd).padStart(2, "0")}/${String(dm + 1).padStart(2, "0")}`;
    dailyBreakdown.push({ date: label, total: r.totalRevenue, delivery: r.deliveryRevenue, items: r.itemsRevenue, orders: r.orderCount });
  }

  // monthly breakdown for current year
  const monthlyBreakdown: { month: string; total: number; delivery: number; items: number; orders: number }[] = [];
  const arabicMonths = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  for (let mi = 0; mi < 12; mi++) {
    const from = toLocalMidnight(y, mi, 1);
    const to   = toLocalMidnight(y, mi + 1, 1);
    const r = await aggregate(from, to);
    monthlyBreakdown.push({ month: arabicMonths[mi], total: r.totalRevenue, delivery: r.deliveryRevenue, items: r.itemsRevenue, orders: r.orderCount });
  }

  const [today, month, year] = await Promise.all([
    aggregate(todayStart, tomorrowStart),
    aggregate(monthStart, nextMonthStart),
    aggregate(yearStart, nextYearStart),
  ]);

  res.json({ today, month, year, dailyBreakdown, monthlyBreakdown });
});

export default router;
