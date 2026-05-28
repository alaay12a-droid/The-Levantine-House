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
  METHOD:   "sms_otp_method",
};

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return rows[0]?.value ?? null;
}
async function setSetting(key: string, value: string) {
  await db.insert(appSettingsTable).values({ key, value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider send implementations
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaMsegat(apiKey: string, sender: string, phone: string, msg: string) {
  const [userName, key] = apiKey.includes(":") ? apiKey.split(":") : [apiKey, apiKey];
  const res = await fetch("https://www.msegat.com/gw/sendsms.php", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, apiKey: key, numbers: phone, userSender: sender, msg, lang: "3" }),
  });
  const text = await res.text();
  let success = false;
  try { const j = JSON.parse(text); success = j.code === "M0000" || j.code === "1" || j.code === 1; } catch { success = res.ok; }
  return { success, response: text };
}

async function sendViaTaqnyat(apiKey: string, sender: string, phone: string, msg: string) {
  const res = await fetch("https://api.taqnyat.sa/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ recipients: [phone], body: msg, sender }),
  });
  const text = await res.text();
  let success = false;
  try { const j = JSON.parse(text); success = res.status === 201 || j.statusCode === 201 || j.code === 201 || res.ok; } catch { success = res.ok; }
  return { success, response: text };
}

async function sendVia4Jawaly(apiKey: string, sender: string, phone: string, msg: string) {
  const [key, secret] = apiKey.includes(":") ? apiKey.split(":") : [apiKey, ""];
  const b64 = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch("https://api-sms.4jawaly.com/api/v1/account/area/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Basic ${b64}` },
    body: JSON.stringify({ messages: [{ text: msg, numbers: phone }], sender }),
  });
  const text = await res.text();
  let success = false;
  try { const j = JSON.parse(text); success = j.success === true || j.status === "success" || res.ok; } catch { success = res.ok; }
  return { success, response: text };
}

async function sendViaUnifonic(apiKey: string, sender: string, phone: string, msg: string) {
  const body = new URLSearchParams({ AppSid: apiKey, SenderID: sender, Body: msg, Recipient: phone });
  const res = await fetch("https://el.cloud.unifonic.com/rest/SMS/messages", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(),
  });
  const text = await res.text();
  let success = false;
  try { const j = JSON.parse(text); success = j.Success === "True" || j.success === true || res.ok; } catch { success = res.ok; }
  return { success, response: text };
}

async function sendViaTwilio(apiKey: string, _sender: string, phone: string, msg: string) {
  const parts = apiKey.split(":");
  if (parts.length < 3) return { success: false, response: "صيغة المفتاح: accountSid:authToken:fromNumber" };
  const [accountSid, authToken, fromNumber] = parts;
  const b64 = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ From: fromNumber, To: phone, Body: msg });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${b64}` },
    body: body.toString(),
  });
  const text = await res.text();
  return { success: res.ok, response: text };
}

// ── Authentica: THEY manage OTP generation & verification ────────────────────
async function sendViaAuthentica(apiKey: string, phone: string, method: string) {
  const res = await fetch("https://api.authentica.sa/api/v2/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "X-Authorization": apiKey },
    body: JSON.stringify({ method: method === "whatsapp" ? "whatsapp" : "sms", phone }),
  });
  const text = await res.text();
  return { success: res.ok, response: text };
}

async function verifyViaAuthentica(apiKey: string, phone: string, otp: string) {
  const res = await fetch("https://api.authentica.sa/api/v2/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "X-Authorization": apiKey },
    body: JSON.stringify({ phone, otp }),
  });
  const text = await res.text();
  let verified = false;
  try { const j = JSON.parse(text); verified = j.verified === true; } catch {}
  return { success: res.ok, verified, response: text };
}

type Provider = "msegat" | "taqnyat" | "4jawaly" | "unifonic" | "twilio" | "authentica";

async function sendSmsViaProvider(provider: Provider, apiKey: string, sender: string, phone: string, msg: string, method: string) {
  switch (provider) {
    case "msegat":     return sendViaMsegat(apiKey, sender, phone, msg);
    case "taqnyat":    return sendViaTaqnyat(apiKey, sender, phone, msg);
    case "4jawaly":    return sendVia4Jawaly(apiKey, sender, phone, msg);
    case "unifonic":   return sendViaUnifonic(apiKey, sender, phone, msg);
    case "twilio":     return sendViaTwilio(apiKey, sender, phone, msg);
    case "authentica": return sendViaAuthentica(apiKey, phone, method);
    default:           return sendViaMsegat(apiKey, sender, phone, msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/sms-settings", async (_req, res) => {
  const [enabled, apiKey, sender, provider, method] = await Promise.all([
    getSetting(S.ENABLED), getSetting(S.API_KEY), getSetting(S.SENDER),
    getSetting(S.PROVIDER), getSetting(S.METHOD),
  ]);
  res.json({
    enabled: enabled === "true",
    apiKey:  apiKey ? "***" : "",
    hasApiKey: !!apiKey,
    sender:  sender ?? "روابي",
    provider: (provider ?? "msegat") as Provider,
    method:   method ?? "sms",
  });
});

router.put("/sms-settings", async (req, res) => {
  const schema = z.object({
    enabled:  z.boolean().optional(),
    apiKey:   z.string().optional(),
    sender:   z.string().optional(),
    provider: z.enum(["msegat","taqnyat","4jawaly","unifonic","twilio","authentica"]).optional(),
    method:   z.enum(["sms","whatsapp"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { enabled, apiKey, sender, provider, method } = parsed.data;
  if (enabled  !== undefined) await setSetting(S.ENABLED,  String(enabled));
  if (apiKey   !== undefined && apiKey !== "***") await setSetting(S.API_KEY, apiKey);
  if (sender   !== undefined) await setSetting(S.SENDER,   sender);
  if (provider !== undefined) await setSetting(S.PROVIDER, provider);
  if (method   !== undefined) await setSetting(S.METHOD,   method);
  res.json({ ok: true });
});

router.post("/sms/send-otp", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "رقم غير صحيح" }); return; }

  const enabled = await getSetting(S.ENABLED);
  if (enabled !== "true") { res.json({ ok: true, skipped: true }); return; }

  const [apiKey, sender, providerRaw, methodRaw] = await Promise.all([
    getSetting(S.API_KEY), getSetting(S.SENDER), getSetting(S.PROVIDER), getSetting(S.METHOD),
  ]);

  const provider = (providerRaw ?? "msegat") as Provider;
  const method   = methodRaw ?? "sms";
  const phone    = parsed.data.phone.replace(/[\s+]/g, "");

  if (!apiKey) {
    // Dev mode: generate code locally for testing
    const code = String(Math.floor(1000 + Math.random() * 9000));
    otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
    req.log.warn({ phone, code }, "SMS OTP dev mode: no API key");
    res.json({ ok: true, devCode: code, otpLength: 4 });
    return;
  }

  // Authentica manages OTP itself — no local code needed
  if (provider === "authentica") {
    req.log.info({ phone, method }, "Sending OTP via Authentica");
    const { success, response } = await sendViaAuthentica(apiKey, phone, method);
    req.log.info({ phone, success, response }, "Authentica send-otp result");
    // Authentica uses 6-digit OTP
    res.json({ ok: true, otpLength: 6, ...(success ? {} : { warning: response }) });
    return;
  }

  // Other providers: we generate and store the code
  const code = String(Math.floor(1000 + Math.random() * 9000));
  otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  const senderName = sender ?? "روابي";
  const message = `${code} رمز التحقق الخاص بطلبك في روابي المندي. صالح 5 دقائق.`;

  req.log.info({ phone, provider, senderName }, "Sending OTP");
  const { success, response } = await sendSmsViaProvider(provider, apiKey, senderName, phone, message, method);
  req.log.info({ phone, success, response }, "OTP send result");

  res.json({ ok: true, otpLength: 4, ...(success ? {} : { warning: response }) });
});

router.post("/sms/verify-otp", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(9), code: z.string().min(4).max(6) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const enabled = await getSetting(S.ENABLED);
  if (enabled !== "true") { res.json({ ok: true, skipped: true }); return; }

  const phone    = parsed.data.phone.replace(/[\s+]/g, "");
  const provider = (await getSetting(S.PROVIDER) ?? "msegat") as Provider;
  const apiKey   = await getSetting(S.API_KEY);

  // Authentica verifies on their side
  if (provider === "authentica") {
    if (!apiKey) { res.status(400).json({ error: "لم يتم إعداد API Key" }); return; }
    const { verified, response } = await verifyViaAuthentica(apiKey, phone, parsed.data.code);
    if (!verified) { res.status(400).json({ error: "الرمز غير صحيح أو منتهي الصلاحية", detail: response }); return; }
    res.json({ ok: true });
    return;
  }

  // Other providers: check our local store
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

  const [apiKey, sender, providerRaw, methodRaw] = await Promise.all([
    getSetting(S.API_KEY), getSetting(S.SENDER), getSetting(S.PROVIDER), getSetting(S.METHOD),
  ]);
  if (!apiKey) { res.status(400).json({ error: "لم يتم إعداد API Key بعد" }); return; }

  const provider   = (providerRaw ?? "msegat") as Provider;
  const method     = methodRaw ?? "sms";
  const phone      = parsed.data.phone.replace(/[\s+]/g, "");
  const senderName = sender ?? "روابي";

  req.log.info({ phone, provider, senderName }, "Test SMS");

  let success: boolean, response: string;
  if (provider === "authentica") {
    ({ success, response } = await sendViaAuthentica(apiKey, phone, method));
  } else {
    ({ success, response } = await sendSmsViaProvider(provider, apiKey, senderName, phone, "اختبار — روابي المندي. نظام الرسائل يعمل ✅", method));
  }
  res.json({ ok: success, response });
});

export default router;
