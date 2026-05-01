import { Router } from "express";
import { db, ordersTable, menuItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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
  paymentMethod: z.enum(["cash", "moyasar"]).default("cash"),
  notes: z.string().nullable().optional(),
});

router.post("/orders", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  const [order] = await db.insert(ordersTable).values({
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerAddress: data.customerAddress ?? null,
    items: data.items,
    totalPrice: Math.round(data.totalPrice * 100),
    paymentMethod: data.paymentMethod,
    notes: data.notes ?? null,
    status: "pending",
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
});

export default router;
