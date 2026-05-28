import { Router } from "express";
import axios from "axios";
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

// ── Helper: send via Authentica ───────────────────────────────────────────────
async function sendViaAuthentica(
  apiKey: string,
  senderName: string,
  phone: string,
  message: string
): Promise<{ success: boolean; response: string }> {
  try {
    const res = await axios.post(
      "https://api.authentica.sa/api/v1/send",
      {
        number:     phone,
        senderName: senderName,
        message:    message,
      },
      {
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    console.log("[Authentica] Response:", res.status, JSON.stringify(res.data));
    return { success: res.status >= 200 && res.status < 300, response: JSON.stringify(res.data) };
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? JSON.stringify(err.response?.data ?? err.message) : String(err);
    console.error("[Authentica] Error:", msg);
    return { success: false, response: msg };
  }
}

// ── GET /sms-settings  (admin reads current config) ──────────────────────────
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

// ── PUT /sms-settings  (admin updates config) ─────────────────────────────────
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

  // Strip spaces and leading + — Authentica expects digits only e.g. 966XXXXXXXXX
  const phone = parsed.data.phone.replace(/[\s+]/g, "");

  const code = String(Math.floor(1000 + Math.random() * 9000));

  // Store OTP with 5-minute expiry
  otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  // No API key → dev mode: return code so app can show it
  if (!apiKey) {
    req.log.warn({ phone, code }, "SMS OTP dev mode: no Authentica API key configured");
    res.json({ ok: true, devCode: code });
    return;
  }

  const message = `${code} هو رمز التحقق الخاص بطلبك في روابي المندي. صالح لمدة 5 دقائق.`;

  req.log.info({ phone, sender }, "Sending OTP via Authentica");
  console.log(`[OTP] Sending to ${phone} via Authentica, sender: ${sender}`);

  const { success, response } = await sendViaAuthentica(apiKey, sender, phone, message);

  req.log.info({ phone, success, response }, "Authentica OTP result");

  if (success) {
    res.json({ ok: true });
  } else {
    req.log.warn({ phone, response }, "Authentica OTP send failed");
    // Return ok so we don't break orders — OTP is still in memory
    res.json({ ok: true, warning: response });
  }
});

// ── POST /sms/test  (admin tests config with a real message) ──────────────────
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

  req.log.info({ phone, senderName }, "Test SMS via Authentica");
  console.log(`[SMS Test] Sending to ${phone}, sender: ${senderName}`);

  const { success, response } = await sendViaAuthentica(
    apiKey,
    senderName,
    phone,
    "اختبار — روابي المندي. نظام الرسائل يعمل بشكل صحيح ✅"
  );

  res.json({ ok: success, authenticaResponse: response });
});

// ── POST /sms/verify-otp ─────────────────────────────────────────────────────
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
