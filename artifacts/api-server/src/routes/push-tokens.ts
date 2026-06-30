import { Router } from "express";
import { db, pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const tokenSchema = z.object({
  token: z.string().min(1),
  fcmToken: z.string().min(1).optional(),
  role: z.enum(["cashier", "customer"]).default("cashier"),
});

router.post("/push-tokens", async (req, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "رمز غير صحيح" });
    return;
  }
  try {
    const { token, fcmToken, role } = parsed.data;
    await db
      .insert(pushTokensTable)
      .values({ token, fcmToken: fcmToken ?? null, role })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: { fcmToken: fcmToken ?? null },
      });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "تعذر حفظ الرمز" });
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
