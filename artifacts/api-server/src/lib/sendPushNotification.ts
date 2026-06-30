import { db, pushTokensTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger.js";

interface PushMessage {
  title: string;
  body: string;
  sound?: "default";
  data?: Record<string, string>;
  channelId?: string;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoResponse {
  data: ExpoTicket[];
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

async function sendViaExpo(
  expoTokens: string[],
  msg: PushMessage,
): Promise<string[]> {
  if (expoTokens.length === 0) return [];
  const invalidTokens: string[] = [];

  for (let i = 0; i < expoTokens.length; i += CHUNK_SIZE) {
    const chunk = expoTokens.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map((to) => ({
      to,
      title: msg.title,
      body: msg.body,
      sound: msg.sound ?? "default",
      channelId: msg.channelId ?? "order-status",
      data: msg.data ?? {},
      priority: "high",
    }));

    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!resp.ok) {
        logger.error({ status: resp.status }, "Expo Push API HTTP error");
        continue;
      }

      const json = (await resp.json()) as ExpoResponse;
      json.data.forEach((ticket, idx) => {
        if (ticket.status === "error") {
          const errCode = ticket.details?.error ?? "";
          logger.warn(
            { errCode, token: chunk[idx] },
            "Expo push failed for token",
          );
          if (errCode === "DeviceNotRegistered") {
            invalidTokens.push(chunk[idx]!);
          }
        }
      });

      const ok = json.data.filter((t) => t.status === "ok").length;
      const fail = json.data.filter((t) => t.status === "error").length;
      logger.info({ ok, fail, chunk: chunk.length }, "Expo push chunk sent");
    } catch (err) {
      logger.error({ err }, "Expo push fetch error");
    }
  }

  return invalidTokens;
}

async function removeStaleExpoTokens(expoTokens: string[]): Promise<void> {
  if (expoTokens.length === 0) return;
  try {
    await db
      .delete(pushTokensTable)
      .where(inArray(pushTokensTable.token, expoTokens));
    logger.info({ count: expoTokens.length }, "Removed stale Expo tokens");
  } catch (err) {
    logger.warn({ err }, "Failed to remove stale Expo tokens");
  }
}

export async function sendPushToAll(msg: PushMessage): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(pushTokensTable)
      .where(eq(pushTokensTable.role, "customer"));

    if (rows.length === 0) {
      logger.warn("No customer push tokens registered — broadcast skipped");
      return;
    }

    const expoTokens = rows
      .map((r) => r.token)
      .filter((t): t is string => !!t && t.startsWith("ExponentPushToken["));

    if (expoTokens.length === 0) {
      logger.warn("No valid Expo tokens found — broadcast skipped");
      return;
    }

    logger.info({ count: expoTokens.length }, "Sending broadcast via Expo Push");
    const stale = await sendViaExpo(expoTokens, msg);
    await removeStaleExpoTokens(stale);
  } catch (err) {
    logger.error({ err }, "Error in sendPushToAll");
  }
}

export async function sendPushToToken(
  expoToken: string,
  msg: PushMessage,
): Promise<void> {
  if (!expoToken || !expoToken.startsWith("ExponentPushToken[")) {
    logger.warn({ expoToken }, "Invalid Expo token format — skipping");
    return;
  }
  try {
    const stale = await sendViaExpo([expoToken], msg);
    await removeStaleExpoTokens(stale);
  } catch (err) {
    logger.error({ err }, "Error in sendPushToToken");
  }
}
