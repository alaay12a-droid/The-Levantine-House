import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// In-memory OTP store: phone → { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();

const SETTING_ENABLED = "sms_otp_enabled";
const SETTING_API_KEY = "sms_otp_api_key";
const SETTING_SENDER  = "sms_otp_sender";

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await db
    .insert(appSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
}

// ── Helper: send via Msegat ───────────────────────────────────────────────────
async function sendViaMsegat(
  userName: string,
  apiKey: string,
  senderName: string,
  phone: string,
  message: string
): Promise<{ success: boolean; response: string }> {
  try {
    const res = await fetch("https://www.msegat.com/gw/sendsms.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName:   userName,
        apiKey:     apiKey,
        numbers:    phone,
        userSender: senderName,
        msg:        message,
        lang:       "3",
      }),
    });
    const text = await res.text();
    console.log("[Msegat] Response:", text);
    let success = false;
    try {
      const json = JSON.parse(text);
      success = json.code === "M0000" || json.code === "1";
    } catch {
      success = res.ok;
    }
    return { success, response: text };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Msegat] Error:", msg);
    return { success: false, response: msg };
  }
}

// ── GET /sms-settings ─────────────────────────────────────────────────────────
router.get("/sms-settings", async (_req, res) => {
  const [enabled, apiKey, sender] = await Promise.all([
    getSetting(SETTING_ENABLED),
    getSetting(SETTING_API_KEY),
    getSetting(SETTING_SENDER),
  ]);
  res.json({
    enabled:   enabled === "true",
    apiKey:    apiKey ? "***" : "",
    hasApiKey: !!apiKey,
    sender:    sender ?? "روابي",
  });
});

// ── PUT /sms-settings ─────────────────────────────────────────────────────────
router.put("/sms-settings", async (req, res) => {
  const schema = z.object({
    enabled: z.boolean().optional(),
    apiKey:  z.string().optional(),
    sender:  z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { enabled, apiKey, sender } = parsed.data;
  if (enabled !== undefined) await setSetting(SETTING_ENABLED, String(enabled));
  if (apiKey !== undefined && apiKey !== "***") await setSetting(SETTING_API_KEY, apiKey);
  if (sender  !== undefined) await setSetting(SETTING_SENDER,  sender);
  res.json({ ok: true });
});

// ── POST /sms/send-otp ────────────────────────────────────────────────────────
router.post("/sms/send-otp", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "رقم غير صحيح" }); return; }

  const enabled = await getSetting(SETTING_ENABLED);
  if (enabled !== "true") { res.json({ ok: true, skipped: true }); return; }

  const apiKey = await getSetting(SETTING_API_KEY);
  const sender = await getSetting(SETTING_SENDER) ?? "روابي";

  const phone = parsed.data.phone.replace(/[\s+]/g, "");
  const code  = String(Math.floor(1000 + Math.random() * 9000));

  otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  if (!apiKey) {
    req.log.warn({ phone, code }, "SMS OTP dev mode: no API key configured");
    res.json({ ok: true, devCode: code });
    return;
  }

  const [userName, key] = apiKey.includes(":") ? apiKey.split(":") : [apiKey, apiKey];
  const message = `${code} هو رمز التحقق الخاص بطلبك في روابي المندي. صالح لمدة 5 دقائق.`;

  req.log.info({ phone, userName, sender }, "Sending OTP via Msegat");

  const { success, response } = await sendViaMsegat(userName, key, sender, phone, message);

  req.log.info({ phone, success, msegatResponse: response }, "Msegat OTP result");

  res.json({ ok: true, ...(success ? {} : { warning: response }) });
});

// ── POST /sms/test ────────────────────────────────────────────────────────────
router.post("/sms/test", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "رقم غير صحيح" }); return; }

  const [apiKey, sender] = await Promise.all([
    getSetting(SETTING_API_KEY),
    getSetting(SETTING_SENDER),
  ]);

  if (!apiKey) { res.status(400).json({ error: "لم يتم إعداد API Key بعد" }); return; }

  const phone      = parsed.data.phone.replace(/[\s+]/g, "");
  const senderName = sender ?? "روابي";
  const [userName, key] = apiKey.includes(":") ? apiKey.split(":") : [apiKey, apiKey];

  req.log.info({ phone, userName, senderName }, "Test SMS via Msegat");

  const { success, response } = await sendViaMsegat(
    userName, key, senderName, phone,
    "اختبار — روابي المندي. نظام الرسائل يعمل بشكل صحيح ✅"
  );

  res.json({ ok: success, msegatResponse: response });
});

// ── POST /sms/verify-otp ──────────────────────────────────────────────────────
router.post("/sms/verify-otp", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9), code: z.string().length(4) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const enabled = await getSetting(SETTING_ENABLED);
  if (enabled !== "true") { res.json({ ok: true, skipped: true }); return; }

  const phone = parsed.data.phone.replace(/[\s+]/g, "");
  const entry = otpStore.get(phone);

  if (!entry) { res.status(400).json({ error: "لم يتم طلب رمز لهذا الرقم" }); return; }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    res.status(400).json({ error: "انتهت صلاحية الرمز، أعد الإرسال" });
    return;
  }
  if (entry.code !== parsed.data.code) {
    res.status(400).json({ error: "الرمز غير صحيح" });
    return;
  }

  otpStore.delete(phone);
  res.json({ ok: true });
});

export default router;
