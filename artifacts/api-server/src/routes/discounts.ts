import { Router } from "express";
import { z } from "zod";
import { db, discountCodesTable, discountCodeUsagesTable, ordersTable } from "@workspace/db";
import { eq, and, count, desc } from "drizzle-orm";

const router = Router();

// ── GET /discount-codes
router.get("/discount-codes", async (_req, res) => {
  const codes = await db.select().from(discountCodesTable).orderBy(discountCodesTable.createdAt);

  const usageCounts = await db
    .select({ discountCodeId: discountCodeUsagesTable.discountCodeId, cnt: count() })
    .from(discountCodeUsagesTable)
    .groupBy(discountCodeUsagesTable.discountCodeId);

  const countMap: Record<number, number> = {};
  for (const u of usageCounts) countMap[u.discountCodeId] = Number(u.cnt);

  res.json(codes.map((c) => ({ ...c, usageCount: countMap[c.id] ?? 0 })));
});

// ── GET /discount-codes/:id/usages
router.get("/discount-codes/:id/usages", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "id غير صحيح" }); return; }

  const usages = await db
    .select({
      id: discountCodeUsagesTable.id,
      phone: discountCodeUsagesTable.phone,
      orderId: discountCodeUsagesTable.orderId,
      usedAt: discountCodeUsagesTable.usedAt,
      orderTotal: ordersTable.totalPrice,
      discountAmount: ordersTable.discountAmount,
    })
    .from(discountCodeUsagesTable)
    .leftJoin(ordersTable, eq(discountCodeUsagesTable.orderId, ordersTable.id))
    .where(eq(discountCodeUsagesTable.discountCodeId, id))
    .orderBy(desc(discountCodeUsagesTable.usedAt));

  const totalSavings = usages.reduce((sum, u) => sum + (u.discountAmount ?? 0), 0);

  res.json({ usages, totalSavings });
});

// ── POST /discount-codes
router.post("/discount-codes", async (req, res) => {
  const parsed = z.object({
    code: z.string().min(1).max(32).toUpperCase(),
    type: z.enum(["fixed", "percentage"]),
    value: z.number().int().min(0),
    minOrder: z.number().int().min(0).default(0),
    description: z.string().default(""),
    active: z.boolean().default(true),
    expiresAt: z.string().datetime().nullable().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [row] = await db.insert(discountCodesTable).values(parsed.data).returning();
    res.status(201).json({ ...row, usageCount: 0 });
  } catch (e: any) {
    if (e?.code === "23505") { res.status(409).json({ error: "الكود موجود مسبقاً" }); return; }
    throw e;
  }
});

// ── PATCH /discount-codes/:id
router.patch("/discount-codes/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "id غير صحيح" }); return; }

  const parsed = z.object({
    code: z.string().min(1).max(32).toUpperCase().optional(),
    type: z.enum(["fixed", "percentage"]).optional(),
    value: z.number().int().min(0).optional(),
    minOrder: z.number().int().min(0).optional(),
    description: z.string().optional(),
    active: z.boolean().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [row] = await db.update(discountCodesTable).set(parsed.data).where(eq(discountCodesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "لم يُوجد الكود" }); return; }
  res.json(row);
});

// ── DELETE /discount-codes/:id
router.delete("/discount-codes/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "id غير صحيح" }); return; }
  await db.delete(discountCodesTable).where(eq(discountCodesTable.id, id));
  res.json({ ok: true });
});

// ── POST /discount-codes/validate  (used by checkout — public)
router.post("/discount-codes/validate", async (req, res) => {
  const parsed = z.object({
    code: z.string().min(1),
    orderTotal: z.number().min(0),
    phone: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const code = parsed.data.code.trim().toUpperCase();
  const [found] = await db.select().from(discountCodesTable)
    .where(eq(discountCodesTable.code, code));

  if (!found || !found.active) { res.status(404).json({ error: "الكود غير صحيح أو غير فعّال" }); return; }
  if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
    res.status(410).json({ error: "انتهت صلاحية هذا الكود" });
    return;
  }
  if (parsed.data.orderTotal < found.minOrder) {
    res.status(422).json({ error: `الحد الأدنى للطلب لاستخدام هذا الكود هو ${found.minOrder} ر.س` });
    return;
  }

  // Check single-use per phone
  if (parsed.data.phone) {
    const phone = parsed.data.phone.trim();
    const [usage] = await db.select().from(discountCodeUsagesTable)
      .where(and(
        eq(discountCodeUsagesTable.discountCodeId, found.id),
        eq(discountCodeUsagesTable.phone, phone),
      ));
    if (usage) {
      res.status(409).json({ error: "لقد استخدمت هذا الكود مسبقاً" });
      return;
    }
  }

  res.json({
    id: found.id,
    code: found.code,
    type: found.type,
    value: found.value,
    minOrder: found.minOrder,
    description: found.description,
  });
});

// ── POST /discount-codes/use  (record usage after order placed)
router.post("/discount-codes/use", async (req, res) => {
  const parsed = z.object({
    codeId: z.number().int(),
    phone: z.string().min(1),
    orderId: z.number().int().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  try {
    await db.insert(discountCodeUsagesTable).values({
      discountCodeId: parsed.data.codeId,
      phone: parsed.data.phone.trim(),
      orderId: parsed.data.orderId ?? null,
    });
    res.json({ ok: true });
  } catch (e: any) {
    // Ignore duplicate (already used) — order already placed, just don't double-record
    res.json({ ok: true });
  }
});

export default router;
