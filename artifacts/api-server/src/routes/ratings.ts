import { Router } from "express";
import { db, ordersTable, orderRatingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const rateSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

router.post("/orders/:id/rate", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

  const [rating] = await db
    .insert(orderRatingsTable)
    .values({ orderId: id, stars: parsed.data.stars, comment: parsed.data.comment ?? null })
    .onConflictDoUpdate({
      target: orderRatingsTable.orderId,
      set: { stars: parsed.data.stars, comment: parsed.data.comment ?? null },
    })
    .returning();

  res.json(rating);
});

router.get("/orders/:id/rate", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const [rating] = await db.select().from(orderRatingsTable).where(eq(orderRatingsTable.orderId, id));
  res.json(rating ?? null);
});

export default router;
