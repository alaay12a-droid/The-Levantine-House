import { Router } from "express";
import { db, ordersTable, menuItemsTable } from "@workspace/db";
import { eq, desc, gte, lt, count, and } from "drizzle-orm";
import { sendPushToAll } from "../lib/sendPushNotification.js";
import { z } from "zod";

const router = Router();

const createOrderSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerAddress: z.string().nullable().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
  totalPrice: z.number().positive(),
  deliveryFee: z.number().min(0).default(0),
  paymentMethod: z.enum(["cash", "moyasar"]).default("cash"),
  notes: z.string().nullable().optional(),
  customerPushToken: z.string().nullable().optional(),
});

router.post("/orders", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;

  // Calculate today's order sequence number (resets at midnight, Saudi time UTC+3)
  const nowUtc = new Date();
  const offsetMs = 3 * 60 * 60 * 1000; // UTC+3
  const nowLocal = new Date(nowUtc.getTime() + offsetMs);
  const todayStart = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - offsetMs);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [{ value: todayCount }] = await db
    .select({ value: count() })
    .from(ordersTable)
    .where(and(gte(ordersTable.createdAt, todayStart), lt(ordersTable.createdAt, tomorrowStart)));

  const dailyNumber = Number(todayCount) + 1;

  const [order] = await db.insert(ordersTable).values({
    dailyNumber,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerAddress: data.customerAddress ?? null,
    items: data.items,
    totalPrice: Math.round(data.totalPrice * 100),
    deliveryFee: Math.round((data.deliveryFee ?? 0) * 100),
    paymentMethod: data.paymentMethod,
    notes: data.notes ?? null,
    status: "pending",
    customerPushToken: data.customerPushToken ?? null,
  }).returning();

  for (const item of data.items) {
    const [menuItem] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.itemId, item.id));
    if (menuItem && menuItem.stock !== null) {
      const newStock = Math.max(0, menuItem.stock - item.quantity);
      await db.update(menuItemsTable)
        .set({ stock: newStock, available: newStock > 0 })
        .where(eq(menuItemsTable.itemId, item.id));
    }
  }

  req.log.info({ orderId: order.id }, "New order created");
  res.status(201).json(order);

  // Send push notification to all registered cashier devices (fire and forget)
  const itemsSummary = data.items.map((i) => `${i.quantity}× ${i.name}`).join("، ");
  sendPushToAll({
    title: `🔔 طلب جديد #${dailyNumber}`,
    body: `${data.customerName} — ${itemsSummary}`,
    sound: "default",
    data: { orderId: order.id },
  });
});

router.get("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  res.json(order);
});

router.get("/orders", async (req, res) => {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);
  res.json(orders);
});

const CUSTOMER_STATUS_MESSAGES: Partial<Record<string, { title: string; body: string }>> = {
  preparing: {
    title: "🍳 جاري تحضير طلبك",
    body: "طلبك قيد التحضير الآن — سيكون جاهز قريباً!",
  },
  ready: {
    title: "✅ طلبك جاهز!",
    body: "تفضل استلم طلبك الآن 🎉",
  },
  done: {
    title: "🙏 شكراً لك",
    body: "تم تسليم طلبك — نتمنى تكون استمتعت بوجبتك!",
  },
};

router.patch("/orders/:id/status", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { status } = req.body as { status: string };
  const validStatuses = ["pending", "preparing", "ready", "done"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "حالة غير صحيحة" });
    return;
  }
  const [order] = await db
    .update(ordersTable)
    .set({ status: status as "pending" | "preparing" | "ready" | "done" })
    .where(eq(ordersTable.id, id))
    .returning();
  if (!order) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  res.json(order);

  // Send push notification to customer if they have a token
  if (order.customerPushToken && CUSTOMER_STATUS_MESSAGES[status]) {
    const msg = CUSTOMER_STATUS_MESSAGES[status]!;
    fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: order.customerPushToken,
        title: msg.title,
        body: msg.body,
        sound: "default",
        data: { orderId: order.id, status },
        channelId: "order-status",
      }),
    }).catch(() => {});
  }
});

export default router;
