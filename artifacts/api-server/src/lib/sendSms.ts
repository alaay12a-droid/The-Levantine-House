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

    const senderName = sender ?? "روابي";
    const cleanPhone  = phone.replace(/[\s+]/g, "");

    // apiKey format: "username:apikey"
    const [userName, key] = apiKey.includes(":") ? apiKey.split(":") : ["", apiKey];

    const res = await fetch("https://www.msegat.com/gw/sendsms.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName:   userName,
        apiKey:     key,
        numbers:    cleanPhone,
        userSender: senderName,
        msg:        message,
        lang:       "3",
      }),
    });

    const text = await res.text();
    logger.info({ phone: cleanPhone, msegatResponse: text }, "Msegat SMS response");
  } catch (err) {
    logger.warn({ err, phone }, "Msegat SMS send failed (non-critical)");
  }
}
