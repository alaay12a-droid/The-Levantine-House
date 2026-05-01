import { db, pushTokensTable } from "@workspace/db";
import { logger } from "./logger.js";

interface PushMessage {
  title: string;
  body: string;
  sound?: "default";
  data?: Record<string, unknown>;
}

export async function sendPushToAll(msg: PushMessage): Promise<void> {
  try {
    const rows = await db.select().from(pushTokensTable);
    if (rows.length === 0) return;

    const messages = rows.map((r) => ({
      to: r.token,
      title: msg.title,
      body: msg.body,
      sound: msg.sound ?? "default",
      data: msg.data ?? {},
      channelId: "orders",
    }));

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      logger.error({ status: res.status }, "Push notification failed");
      return;
    }

    const result = await res.json() as { data: Array<{ status: string; id?: string; message?: string }> };
    const failed = result.data?.filter((d) => d.status !== "ok") ?? [];
    if (failed.length > 0) {
      logger.warn({ failed }, "Some push notifications failed");
    }
  } catch (err) {
    logger.error({ err }, "Error sending push notifications");
  }
}
