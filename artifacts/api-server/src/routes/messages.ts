import { Router } from "express";
import { db, messagesTable, ordersTable } from "@workspace/db";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { sendPushToAll, sendPushToToken } from "../lib/sendPushNotification.js";

const router = Router();

const sendSchema = z.object({
  text: z.string().min(1).max(1000),
  fromCashier: z.boolean().default(false),
});

// GET /messages/conversations — all convos with unread count (cashier panel)
router.get("/messages/conversations", async (req, res) => {
  try {
    const rows = await db
      .select({
        orderId:      messagesTable.orderId,
        lastText:     messagesTable.text,
        fromCashier:  messagesTable.fromCashier,
        lastAt:       messagesTable.createdAt,
      })
      .from(messagesTable)
      .orderBy(desc(messagesTable.createdAt));

    // group by orderId: keep latest message + count unread from customer
    const map = new Map<number, {
      orderId: number;
      lastText: string;
      fromCashier: boolean;
      lastAt: Date;
      unread: number;
    }>();
    const unreadCounts = new Map<number, number>();

    for (const r of rows) {
      if (!map.has(r.orderId)) {
        map.set(r.orderId, { orderId: r.orderId, lastText: r.lastText, fromCashier: r.fromCashier, lastAt: r.lastAt, unread: 0 });
      }
    }

    // count unread customer messages per order
    const unreadRows = await db
      .select({ orderId: messagesTable.orderId, cnt: sql<number>`count(*)` })
      .from(messagesTable)
      .where(and(eq(messagesTable.fromCashier, false), isNull(messagesTable.readAt)))
      .groupBy(messagesTable.orderId);

    for (const u of unreadRows) unreadCounts.set(u.orderId, Number(u.cnt));

    // attach order info
    const orderIds = [...map.keys()];
    const orders = orderIds.length
      ? await db.select({ id: ordersTable.id, dailyNumber: ordersTable.dailyNumber, customerName: ordersTable.customerName, status: ordersTable.status })
          .from(ordersTable)
          .where(sql`${ordersTable.id} = ANY(ARRAY[${sql.join(orderIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
      : [];

    const orderMap = new Map(orders.map((o) => [o.id, o]));

    const result = [...map.values()]
      .map((c) => ({
        ...c,
        unread: unreadCounts.get(c.orderId) ?? 0,
        order: orderMap.get(c.orderId) ?? null,
      }))
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "فشل تحميل المحادثات" });
  }
});

// GET /messages/unread-customer — unread cashier→customer messages per order (for customer badge)
router.get("/messages/unread-customer", async (req, res) => {
  try {
    const rows = await db
      .select({ orderId: messagesTable.orderId, cnt: sql<number>`count(*)` })
      .from(messagesTable)
      .where(and(eq(messagesTable.fromCashier, true), isNull(messagesTable.readAt)))
      .groupBy(messagesTable.orderId);
    const result: Record<number, number> = {};
    for (const r of rows) result[r.orderId] = Number(r.cnt);
    res.json(result);
  } catch {
    res.status(500).json({ error: "فشل" });
  }
});

// GET /messages/order/:orderId — messages for one order
router.get("/messages/order/:orderId", async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) { res.status(400).json({ error: "orderId غير صحيح" }); return; }
  try {
    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.orderId, orderId))
      .orderBy(messagesTable.createdAt);
    res.json(msgs);
  } catch {
    res.status(500).json({ error: "فشل تحميل الرسائل" });
  }
});

// POST /messages/order/:orderId — send a message
router.post("/messages/order/:orderId", async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) { res.status(400).json({ error: "orderId غير صحيح" }); return; }
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  try {
    const [msg] = await db.insert(messagesTable).values({
      orderId,
      text: parsed.data.text,
      fromCashier: parsed.data.fromCashier,
    }).returning();
    res.json(msg);

    // Fire-and-forget push notifications
    if (parsed.data.fromCashier) {
      // Cashier → customer: push to the customer's device token stored on the order
      const [order] = await db
        .select({ customerPushToken: ordersTable.customerPushToken, dailyNumber: ordersTable.dailyNumber })
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId));
      if (order?.customerPushToken) {
        sendPushToToken(order.customerPushToken, {
          title: "💬 رسالة من الكاشير",
          body: parsed.data.text.length > 80 ? parsed.data.text.slice(0, 77) + "…" : parsed.data.text,
          sound: "default",
          data: { orderId, type: "message" },
          channelId: "order-status",
        }).catch(() => {});
      }
    } else {
      // Customer → cashier: push to all registered cashier devices
      const [order] = await db
        .select({ dailyNumber: ordersTable.dailyNumber, customerName: ordersTable.customerName })
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId));
      sendPushToAll({
        title: `💬 رسالة من عميل — طلب #${order?.dailyNumber ?? orderId}`,
        body: `${order?.customerName ?? ""}: ${parsed.data.text.length > 60 ? parsed.data.text.slice(0, 57) + "…" : parsed.data.text}`,
        sound: "default",
        data: { orderId, type: "message" },
      }).catch(() => {});
    }
  } catch {
    res.status(500).json({ error: "فشل إرسال الرسالة" });
  }
});

// PATCH /messages/order/:orderId/read — mark messages as read
// { fromCashier: true } → marks customer messages as read (cashier opened the chat)
// { fromCashier: false } → marks cashier messages as read (customer opened the chat)
router.patch("/messages/order/:orderId/read", async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) { res.status(400).json({ error: "orderId غير صحيح" }); return; }
  const { fromCashier } = req.body;
  try {
    await db
      .update(messagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messagesTable.orderId, orderId),
          eq(messagesTable.fromCashier, !fromCashier),
          isNull(messagesTable.readAt)
        )
      );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "فشل التحديث" });
  }
});

export default router;
