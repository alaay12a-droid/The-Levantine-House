import { db, pushTokensTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger.js";
import { getFCMMessaging } from "./firebase.js";

export interface PushMessage {
  title: string;
  body: string;
  sound?: "default";
  data?: Record<string, string>;
  channelId?: string;
}

// ── FCM (Firebase Admin) — primary delivery path ─────────────────────────────

async function sendViaFCM(fcmTokens: string[], msg: PushMessage): Promise<string[]> {
  if (fcmTokens.length === 0) return [];
  const messaging = getFCMMessaging();
  if (!messaging) return [];

  const stale: string[] = [];
  const CHUNK = 500; // FCM multicast limit

  for (let i = 0; i < fcmTokens.length; i += CHUNK) {
    const chunk = fcmTokens.slice(i, i + CHUNK);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title: msg.title, body: msg.body },
        android: {
          priority: "high",
          notification: {
            channelId: msg.channelId ?? "order-status",
            sound: msg.sound ?? "default",
            color: "#E8920C",
          },
        },
        data: msg.data ?? {},
      });

      res.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = r.error?.code ?? "";
        logger.warn({ code, token: chunk[idx] }, "FCM send failed for token");
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          stale.push(chunk[idx]!);
        }
      });

      logger.info(
        { ok: res.successCount, fail: res.failureCount, chunk: chunk.length },
        "FCM multicast chunk sent",
      );
    } catch (err) {
      logger.error({ err }, "FCM multicast error");
    }
  }

  return stale;
}

// ── Expo Push API — fallback for tokens without FCM token ────────────────────

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK = 100;

async function sendViaExpo(expoTokens: string[], msg: PushMessage): Promise<string[]> {
  if (expoTokens.length === 0) return [];
  const invalid: string[] = [];

  for (let i = 0; i < expoTokens.length; i += EXPO_CHUNK) {
    const chunk = expoTokens.slice(i, i + EXPO_CHUNK);
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
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });

      if (!resp.ok) {
        logger.error({ status: resp.status }, "Expo Push API HTTP error");
        continue;
      }

      const json = (await resp.json()) as { data: ExpoTicket[] };
      json.data.forEach((ticket, idx) => {
        if (ticket.status === "error") {
          const errCode = ticket.details?.error ?? "";
          logger.warn({ errCode, token: chunk[idx] }, "Expo push failed for token");
          if (errCode === "DeviceNotRegistered" || errCode === "InvalidCredentials") {
            invalid.push(chunk[idx]!);
          }
        }
      });

      logger.info(
        {
          ok: json.data.filter((t) => t.status === "ok").length,
          fail: json.data.filter((t) => t.status === "error").length,
          chunk: chunk.length,
        },
        "Expo push chunk sent",
      );
    } catch (err) {
      logger.error({ err }, "Expo push fetch error");
    }
  }

  return invalid;
}

// ── Stale token cleanup ───────────────────────────────────────────────────────

async function removeStaleExpoTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  try {
    await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, tokens));
    logger.info({ count: tokens.length }, "Removed stale Expo tokens");
  } catch (err) {
    logger.warn({ err }, "Failed to remove stale Expo tokens");
  }
}

async function removeStaleByFCMToken(fcmTokens: string[]): Promise<void> {
  if (fcmTokens.length === 0) return;
  try {
    await db.delete(pushTokensTable).where(inArray(pushTokensTable.fcmToken, fcmTokens));
    logger.info({ count: fcmTokens.length }, "Removed stale FCM token rows");
  } catch (err) {
    logger.warn({ err }, "Failed to remove stale FCM rows");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Broadcast to all registered customer devices.
 * - Devices with an FCM token  → Firebase Admin SDK (direct FCM)
 * - Devices without FCM token  → Expo Push API (fallback)
 */
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

    const fcmTokens = rows
      .map((r) => r.fcmToken)
      .filter((t): t is string => !!t);

    const expoOnlyTokens = rows
      .filter((r) => !r.fcmToken)
      .map((r) => r.token)
      .filter((t): t is string => !!t && t.startsWith("ExponentPushToken["));

    logger.info(
      { fcm: fcmTokens.length, expo: expoOnlyTokens.length },
      "Sending broadcast",
    );

    const [staleFCM, staleExpo] = await Promise.all([
      sendViaFCM(fcmTokens, msg),
      sendViaExpo(expoOnlyTokens, msg),
    ]);

    await Promise.all([
      removeStaleByFCMToken(staleFCM),
      removeStaleExpoTokens(staleExpo),
    ]);
  } catch (err) {
    logger.error({ err }, "Error in sendPushToAll");
  }
}

/**
 * Send a notification to a specific device identified by its Expo token.
 * Looks up the associated FCM token in the DB and prefers FCM delivery;
 * falls back to Expo Push API when no FCM token is stored.
 */
export async function sendPushToToken(
  expoToken: string,
  msg: PushMessage,
): Promise<void> {
  if (!expoToken) return;
  try {
    // Look up the associated FCM token
    const rows = await db
      .select({ fcmToken: pushTokensTable.fcmToken })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.token, expoToken))
      .limit(1);

    const fcmToken = rows[0]?.fcmToken ?? null;

    if (fcmToken) {
      const stale = await sendViaFCM([fcmToken], msg);
      await removeStaleByFCMToken(stale);
    } else if (expoToken.startsWith("ExponentPushToken[")) {
      const stale = await sendViaExpo([expoToken], msg);
      await removeStaleExpoTokens(stale);
    } else {
      logger.warn({ expoToken }, "No valid delivery token — targeted push skipped");
    }
  } catch (err) {
    logger.error({ err }, "Error in sendPushToToken");
  }
}
