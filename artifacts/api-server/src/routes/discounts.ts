import { Router } from "express";
import { z } from "zod";
import { db, discountCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ── GET /discount-codes
router.get("/discount-codes", async (_req, res) => {
  const codes = await db.select().from(discountCodesTable).orderBy(discountCodesTable.createdAt);
  res.json(codes);
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
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [row] = await db.insert(discountCodesTable).values(parsed.data).returning();
    res.status(201).json(row);
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
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const code = parsed.data.code.trim().toUpperCase();
  const [found] = await db.select().from(discountCodesTable)
    .where(eq(discountCodesTable.code, code));

  if (!found || !found.active) { res.status(404).json({ error: "الكود غير صحيح أو غير فعّال" }); return; }
  if (parsed.data.orderTotal < found.minOrder) {
    res.status(422).json({ error: `الحد الأدنى للطلب لاستخدام هذا الكود هو ${found.minOrder} ر.س` });
    return;
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

export default router;
