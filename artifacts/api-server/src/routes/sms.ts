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

// ── GET /sms-settings  (admin reads current config)
router.get("/sms-settings", async (_req, res) => {
  const [enabled, apiKey, sender] = await Promise.all([
    getSetting(SETTING_ENABLED),
    getSetting(SETTING_API_KEY),
    getSetting(SETTING_SENDER),
  ]);
  res.json({
    enabled: enabled === "true",
    apiKey: apiKey ? "***" : "",        // never expose key to client
    hasApiKey: !!apiKey,
    sender: sender ?? "روابي المندي",
  });
});

// ── PUT /sms-settings  (admin updates config)
router.put("/sms-settings", async (req, res) => {
  const schema = z.object({
    enabled: z.boolean().optional(),
    apiKey: z.string().optional(),
    sender: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { enabled, apiKey, sender } = parsed.data;
  if (enabled !== undefined) await setSetting(SETTING_ENABLED, String(enabled));
  if (apiKey !== undefined && apiKey !== "***") await setSetting(SETTING_API_KEY, apiKey);
  if (sender !== undefined) await setSetting(SETTING_SENDER, sender);
  res.json({ ok: true });
});

// ── POST /sms/send-otp
router.post("/sms/send-otp", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "رقم غير صحيح" }); return; }

  const enabled = await getSetting(SETTING_ENABLED);
  if (enabled !== "true") { res.json({ ok: true, skipped: true }); return; }

  const apiKey = await getSetting(SETTING_API_KEY);
  const sender = await getSetting(SETTING_SENDER) ?? "روابي المندي";
  if (!apiKey) { res.status(500).json({ error: "لم يتم ضبط مفتاح API للرسائل" }); return; }

  const code = String(Math.floor(1000 + Math.random() * 9000));
  const phone = parsed.data.phone.replace(/\s/g, "");

  // store with 5-minute expiry
  otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  const message = encodeURIComponent(`${code} هو رمز التحقق الخاص بطلبك في روابي المندي. صالح لمدة 5 دقائق.`);
  const url = `https://www.msegat.com/gw/sendsms.php?userName=${encodeURIComponent(apiKey)}&apiKey=${encodeURIComponent(apiKey)}&numbers=${encodeURIComponent(phone)}&userSender=${encodeURIComponent(sender)}&msg=${message}&lang=3`;

  // Msegat: userName = the username (not API key), apiKey = the API key
  // We store them as a combined "user:key" or just apiKey. 
  // Let's use the simpler JSON API instead:
  const msegatRes = await fetch("https://www.msegat.com/gw/sendsms.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: apiKey.split(":")[0] ?? apiKey,
      apiKey:   apiKey.split(":")[1] ?? apiKey,
      numbers:  phone,
      userSender: sender,
      msg: `${code} هو رمز التحقق الخاص بطلبك في روابي المندي. صالح لمدة 5 دقائق.`,
      lang: "3",
    }),
  });

  const text = await msegatRes.text();
  // Msegat returns "1" on success
  if (text.trim() === "1" || text.includes('"type":"1"')) {
    res.json({ ok: true });
  } else {
    // still return ok so we don't break orders if SMS fails — code is in memory
    res.json({ ok: true, warning: text });
  }
});

// ── POST /sms/verify-otp
router.post("/sms/verify-otp", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9), code: z.string().length(4) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const enabled = await getSetting(SETTING_ENABLED);
  if (enabled !== "true") { res.json({ ok: true, skipped: true }); return; }

  const phone = parsed.data.phone.replace(/\s/g, "");
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
