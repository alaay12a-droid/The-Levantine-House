import axios from "axios";
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

    const response = await axios.post(
      "https://api.authentica.sa/api/v1/send",
      {
        number:     cleanPhone,
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

    logger.info({ phone: cleanPhone, status: response.status, data: response.data }, "Authentica SMS sent");
  } catch (err) {
    logger.warn({ err, phone }, "Authentica SMS send failed (non-critical)");
  }
}
