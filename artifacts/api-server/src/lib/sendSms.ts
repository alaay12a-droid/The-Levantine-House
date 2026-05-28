import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return rows[0]?.value ?? null;
}

export async function sendSms(phone: string, message: string): Promise<void> {
  try {
    const [enabled, apiKey, sender] = await Promise.all([
      getSetting("sms_otp_enabled"),
      getSetting("sms_otp_api_key"),
      getSetting("sms_otp_sender"),
    ]);

    if (enabled !== "true" || !apiKey) return;

    const senderName = sender ?? "روابي المندي";
    const cleanPhone  = phone.replace(/[\s+]/g, ""); // strip spaces and leading +

    await fetch("https://www.msegat.com/gw/sendsms.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName:   apiKey.split(":")[0] ?? apiKey,
        apiKey:     apiKey.split(":")[1] ?? apiKey,
        numbers:    cleanPhone,
        userSender: senderName,
        msg:        message,
        lang:       "3",
      }),
    });
  } catch (err) {
    logger.warn({ err, phone }, "SMS send failed (non-critical)");
  }
}
