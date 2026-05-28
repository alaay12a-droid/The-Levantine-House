import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const otpStore = new Map<string, { code: string; expiresAt: number }>();

const S = {
  ENABLED:  "sms_otp_enabled",
  API_KEY:  "sms_otp_api_key",
  SENDER:   "sms_otp_sender",
  PROVIDER: "sms_otp_provider",
};

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

// ─────────────────────────────────────────────────────────────────────────────
// Provider implementations
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaMsegat(apiKey: string, sender: string, phone: string, message: string): Promise<{ success: boolean; response: string }> {
  const [userName, key] = apiKey.includes(":") ? apiKey.split(":") : [apiKey, apiKey];
  const res = await fetch("https://www.msegat.com/gw/sendsms.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, apiKey: key, numbers: phone, userSender: sender, msg: message, lang: "3" }),
  });
  const text = await res.text();
  let success = false;
  try { const j = JSON.parse(text); success = j.code === "M0000" || j.code === "1" || j.code === 1; } catch { success = res.ok; }
  return { success, response: text };
}

async function sendViaTaqnyat(apiKey: string, sender: string, phone: string, message: string): Promise<{ success: boolean; response: string }> {
  const res = await fetch("https://api.taqnyat.sa/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ recipients: [phone], body: message, sender }),
  });
  const text = await res.text();
  let success = false;
  try { const j = JSON.parse(text); success = res.status === 201 || j.statusCode === 201 || j.code === 201 || res.ok; } catch { success = res.ok; }
  return { success, response: text };
}

async function sendVia4Jawaly(apiKey: string, sender: string, phone: string, message: string): Promise<{ success: boolean; response: string }> {
  // apiKey format: "api_key:api_secret"
  const [key, secret] = apiKey.includes(":") ? apiKey.split(":") : [apiKey, ""];
  const b64 = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch("https://api-sms.4jawaly.com/api/v1/account/area/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Basic ${b64}` },
    body: JSON.stringify({ messages: [{ text: message, numbers: phone }], sender }),
  });
  const text = await res.text();
  let success = false;
  try { const j = JSON.parse(text); success = j.success === true || j.status === "success" || res.ok; } catch { success = res.ok; }
  return { success, response: text };
}

async function sendViaUnifonic(apiKey: string, sender: string, phone: string, message: string): Promise<{ success: boolean; response: string }> {
  // apiKey = AppSid
  const body = new URLSearchParams({ AppSid: apiKey, SenderID: sender, Body: message, Recipient: phone });
  const res = await fetch("https://el.cloud.unifonic.com/rest/SMS/messages", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let success = false;
  try { const j = JSON.parse(text); success = j.Success === "True" || j.success === true || res.ok; } catch { success = res.ok; }
  return { success, response: text };
}

async function sendViaTwilio(apiKey: string, _sender: string, phone: string, message: string): Promise<{ success: boolean; response: string }> {
  // apiKey format: "accountSid:authToken:fromNumber"  e.g. "ACxxx:authToken:+1415..."
  const parts = apiKey.split(":");
  if (parts.length < 3) return { success: false, response: "صيغة المفتاح: accountSid:authToken:fromNumber" };
  const [accountSid, authToken, fromNumber] = parts;
  const b64 = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ From: fromNumber, To: phone, Body: message });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${b64}` },
    body: body.toString(),
  });
  const text = await res.text();
  return { success: res.ok, response: text };
}

type Provider = "msegat" | "taqnyat" | "4jawaly" | "unifonic" | "twilio";

async function sendSmsViaProvider(provider: Provider, apiKey: string, sender: string, phone: string, message: string) {
  switch (provider) {
    case "msegat":   return sendViaMsegat(apiKey, sender, phone, message);
    case "taqnyat":  return sendViaTaqnyat(apiKey, sender, phone, message);
    case "4jawaly":  return sendVia4Jawaly(apiKey, sender, phone, message);
    case "unifonic": return sendViaUnifonic(apiKey, sender, phone, message);
    case "twilio":   return sendViaTwilio(apiKey, sender, phone, message);
    default:         return sendViaMsegat(apiKey, sender, phone, message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/sms-settings", async (_req, res) => {
  const [enabled, apiKey, sender, provider] = await Promise.all([
    getSetting(S.ENABLED),
    getSetting(S.API_KEY),
    getSetting(S.SENDER),
    getSetting(S.PROVIDER),
  ]);
  res.json({
    enabled:   enabled === "true",
    apiKey:    apiKey ? "***" : "",
    hasApiKey: !!apiKey,
    sender:    sender ?? "روابي",
    provider:  (provider as Provider) ?? "msegat",
  });
});

router.put("/sms-settings", async (req, res) => {
  const schema = z.object({
    enabled:  z.boolean().optional(),
    apiKey:   z.string().optional(),
    sender:   z.string().optional(),
    provider: z.enum(["msegat", "taqnyat", "4jawaly", "unifonic", "twilio"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { enabled, apiKey, sender, provider } = parsed.data;
  if (enabled  !== undefined) await setSetting(S.ENABLED,  String(enabled));
  if (apiKey   !== undefined && apiKey !== "***") await setSetting(S.API_KEY,  apiKey);
  if (sender   !== undefined) await setSetting(S.SENDER,   sender);
  if (provider !== undefined) await setSetting(S.PROVIDER, provider);
  res.json({ ok: true });
});

router.post("/sms/send-otp", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "رقم غير صحيح" }); return; }

  const enabled = await getSetting(S.ENABLED);
  if (enabled !== "true") { res.json({ ok: true, skipped: true }); return; }

  const [apiKey, sender, providerRaw] = await Promise.all([
    getSetting(S.API_KEY),
    getSetting(S.SENDER),
    getSetting(S.PROVIDER),
  ]);

  const provider = (providerRaw ?? "msegat") as Provider;
  const phone = parsed.data.phone.replace(/[\s+]/g, "");
  const code  = String(Math.floor(1000 + Math.random() * 9000));
  otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  if (!apiKey) {
    req.log.warn({ phone, code }, "SMS OTP dev mode: no API key");
    res.json({ ok: true, devCode: code });
    return;
  }

  const senderName = sender ?? "روابي";
  const message = `${code} رمز التحقق الخاص بطلبك في روابي المندي. صالح 5 دقائق.`;

  req.log.info({ phone, provider, senderName }, "Sending OTP");
  const { success, response } = await sendSmsViaProvider(provider, apiKey, senderName, phone, message);
  req.log.info({ phone, success, response }, "OTP send result");

  res.json({ ok: true, ...(success ? {} : { warning: response }) });
});

router.post("/sms/verify-otp", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9), code: z.string().length(4) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const enabled = await getSetting(S.ENABLED);
  if (enabled !== "true") { res.json({ ok: true, skipped: true }); return; }

  const phone = parsed.data.phone.replace(/[\s+]/g, "");
  const entry = otpStore.get(phone);

  if (!entry) { res.status(400).json({ error: "لم يتم طلب رمز لهذا الرقم" }); return; }
  if (Date.now() > entry.expiresAt) { otpStore.delete(phone); res.status(400).json({ error: "انتهت صلاحية الرمز، أعد الإرسال" }); return; }
  if (entry.code !== parsed.data.code) { res.status(400).json({ error: "الرمز غير صحيح" }); return; }

  otpStore.delete(phone);
  res.json({ ok: true });
});

router.post("/sms/test", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "رقم غير صحيح" }); return; }

  const [apiKey, sender, providerRaw] = await Promise.all([
    getSetting(S.API_KEY),
    getSetting(S.SENDER),
    getSetting(S.PROVIDER),
  ]);

  if (!apiKey) { res.status(400).json({ error: "لم يتم إعداد API Key بعد" }); return; }

  const provider    = (providerRaw ?? "msegat") as Provider;
  const phone       = parsed.data.phone.replace(/[\s+]/g, "");
  const senderName  = sender ?? "روابي";

  req.log.info({ phone, provider, senderName }, "Test SMS");
  const { success, response } = await sendSmsViaProvider(provider, apiKey, senderName, phone, "اختبار — روابي المندي. نظام الرسائل يعمل ✅");
  res.json({ ok: success, response });
});

export default router;
