import { Router } from "express";
import { db, pushTokensTable, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const tokenSchema = z.object({
  token: z.string().min(1),
  fcmToken: z.string().min(1).optional(),
  role: z.enum(["cashier", "customer", "driver"]).default("cashier"),
  driverId: z.number().int().positive().optional(),
});

router.post("/push-tokens", async (req, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "رمز غير صحيح" });
    return;
  }
  try {
    const { token, fcmToken, role, driverId } = parsed.data;
    await db
      .insert(pushTokensTable)
      .values({ token, fcmToken: fcmToken ?? null, role, driverId: driverId ?? null })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: { fcmToken: fcmToken ?? null, role, driverId: driverId ?? null },
      });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "تعذر حفظ الرمز" });
  }
});

const heartbeatSchema = z.object({
  token: z.string().min(1),
  name: z.string().optional(),
});

router.post("/push-tokens/heartbeat", async (req, res) => {
  const parsed = heartbeatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  try {
    const { token, name } = parsed.data;
    const now = new Date();
    const setPayload: Record<string, unknown> = {
      lastActiveAt: now,
      reEngagementSentAt: null,
    };
    if (name?.trim()) setPayload.customerName = name.trim();

    await db
      .update(pushTokensTable)
      .set(setPayload)
      .where(eq(pushTokensTable.token, token));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "تعذر تحديث النشاط" });
  }
});

router.get("/settings/reengagement", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "reengagement_days"));
    res.json({ days: parseInt(row?.value ?? "30", 10) || 30 });
  } catch {
    res.status(500).json({ error: "تعذر جلب الإعداد" });
  }
});

router.put("/settings/reengagement", async (req, res) => {
  const schema = z.object({ days: z.number().int().min(1).max(365) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "قيمة غير صحيحة" });
    return;
  }
  try {
    await db
      .insert(appSettingsTable)
      .values({ key: "reengagement_days", value: String(parsed.data.days) })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: String(parsed.data.days), updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "تعذر حفظ الإعداد" });
  }
});

router.delete("/push-tokens/:token", async (req, res) => {
  try {
    await db.delete(pushTokensTable).where(eq(pushTokensTable.token, req.params.token));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "تعذر الحذف" });
  }
});

export default router;
