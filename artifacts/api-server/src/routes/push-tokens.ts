import { Router } from "express";
import {
  db,
  pushTokensTable,
  appSettingsTable,
  ordersTable,
  walletsTable,
  walletTransactionsTable,
  referralsTable,
  discountCodeUsagesTable,
  deletedAccountsTable,
} from "@workspace/db";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { sendPushToToken, getLastReceiptResult } from "../lib/sendPushNotification.js";
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

// ── Hard account deletion ──────────────────────────────────────────────────────
// Permanently removes the customer's personal data from every table.
// Orders are anonymised (not deleted) so accounting records remain intact.
// A minimal tombstone row (phone + timestamp) is written to deleted_accounts
// to enforce the 30-day re-registration cooldown.
const deleteAccountSchema = z.object({
  token: z.string().min(1),
  phone: z.string().min(1),
});

router.post("/account/delete", async (req, res) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  const { token, phone } = parsed.data;
  try {
    // 1. Anonymise orders — keep for business accounting, strip personal info
    await db
      .update(ordersTable)
      .set({
        customerName: "حساب محذوف",
        customerPhone: `deleted_${Date.now()}`,
        customerAddress: null,
        customerPushToken: null,
      })
      .where(eq(ordersTable.customerPhone, phone));

    // 2. Delete wallet balance (personal financial account)
    await db.delete(walletsTable).where(eq(walletsTable.phone, phone));

    // 3. Delete wallet transaction history
    await db.delete(walletTransactionsTable).where(eq(walletTransactionsTable.phone, phone));

    // 4. Delete referral records (contains name + phone of both parties)
    await db
      .delete(referralsTable)
      .where(
        or(eq(referralsTable.referrerPhone, phone), eq(referralsTable.referredPhone, phone))
      );

    // 5. Delete discount code usage history
    await db.delete(discountCodeUsagesTable).where(eq(discountCodeUsagesTable.phone, phone));

    // 6. Delete push token (device notification token + customer name)
    await db.delete(pushTokensTable).where(eq(pushTokensTable.token, token));

    // 7. Record tombstone for 30-day re-registration cooldown
    await db
      .insert(deletedAccountsTable)
      .values({ phone })
      .onConflictDoUpdate({
        target: deletedAccountsTable.phone,
        set: { deletedAt: new Date() },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "account deletion failed");
    res.status(500).json({ error: "تعذر حذف الحساب" });
  }
});

// ── iOS push-token debug logger ───────────────────────────────────────────────
// Receives the error thrown by getExpoPushTokenAsync on the device and writes
// it to the server log so it appears in Render's log stream.
router.post("/push-token-error", (req, res) => {
  req.log.error({ payload: req.body }, "iOS push-token registration failed on device");
  res.json({ ok: true });
});

// ── Direct push test — for diagnosing iOS delivery without placing a real order ──
// POST /push-tokens/test-send  { token: "ExponentPushToken[...]", title?, body? }
// Uses the full sendPushToToken flow (FCM → Expo fallback + 60 s receipt check).
// Receipt result appears in server logs ~60 s after this call.
router.post("/push-tokens/test-send", async (req, res) => {
  const { token, title, body } = req.body as { token?: string; title?: string; body?: string };
  if (!token || !token.startsWith("ExponentPushToken[")) {
    res.status(400).json({ error: "Provide a valid ExponentPushToken" });
    return;
  }
  req.log.info({ token: token.slice(0, 30) }, "push-tokens/test-send — starting full delivery flow");
  res.json({ ok: true, message: "Push dispatched — receipt check fires in ~60 s, see server logs" });

  // Run after response so the caller doesn't wait for delivery
  sendPushToToken(token, {
    title: title ?? "🔔 اختبار إشعار",
    body: body ?? "وصل هذا الإشعار بنجاح إلى الجهاز — " + new Date().toISOString().slice(11, 19),
    sound: "default",
    data: { test: "true", ts: Date.now().toString() },
    channelId: "order-status",
  }).catch((err) => req.log.error({ err }, "push-tokens/test-send delivery error"));
});

// ── Diagnostic: send test push to the 5 most recently registered iOS tokens ──────
// POST /debug/push-latest-ios
// Queries the DB for the 5 newest iOS customer tokens (no fcm_token = iOS path),
// fires sendPushToToken for each. This covers both Expo Go tokens and App Store
// build tokens since they look identical in the DB.
// Receipts appear in server logs ~60 s later — each row logs its masked token.
router.post("/debug/push-latest-ios", async (req, res) => {
  try {
    const rows = await db
      .select({ token: pushTokensTable.token, createdAt: pushTokensTable.createdAt })
      .from(pushTokensTable)
      .where(
        and(
          eq(pushTokensTable.role, "customer"),
          isNull(pushTokensTable.fcmToken),
        ),
      )
      .orderBy(desc(pushTokensTable.createdAt))
      .limit(5);

    if (!rows.length) {
      res.status(404).json({ error: "No iOS customer token found in DB" });
      return;
    }

    const ts = new Date().toISOString().slice(11, 19);
    const summary = rows.map((r) => ({ masked: r.token.slice(0, 30) + "…", createdAt: r.createdAt }));
    req.log.info({ tokens: summary }, "debug/push-latest-ios — dispatching to all iOS tokens");

    // Send to all tokens then wait 65 s for the Expo receipt check to fire
    await Promise.all(rows.map(({ token }) =>
      sendPushToToken(token, {
        title: "🔔 اختبار App Store iOS",
        body: "هذا إشعار تشخيصي — " + ts,
        sound: "default",
        data: { test: "true", ts: Date.now().toString() },
        channelId: "order-status",
      }).catch((err) => req.log.error({ err, masked: token.slice(0, 30) }, "debug/push-latest-ios delivery error"))
    ));

    // Wait for the deferred receipt check (fires at 60 s, give 5 s buffer)
    await new Promise((r) => setTimeout(r, 65_000));
    const receipt = getLastReceiptResult();
    res.json({ ok: true, count: rows.length, tokens: summary, receipt });
  } catch (err) {
    req.log.error({ err }, "debug/push-latest-ios failed");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
