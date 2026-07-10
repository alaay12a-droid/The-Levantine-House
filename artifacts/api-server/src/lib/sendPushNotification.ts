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

interface FCMResult {
  stale: string[];      // invalid/unregistered tokens — remove from DB
  successCount: number; // how many were delivered successfully
}

async function sendViaFCM(fcmTokens: string[], msg: PushMessage): Promise<FCMResult> {
  if (fcmTokens.length === 0) return { stale: [], successCount: 0 };
  const messaging = getFCMMessaging();
  if (!messaging) return { stale: [], successCount: 0 };

  const stale: string[] = [];
  let successCount = 0;
  const CHUNK = 500; // FCM multicast limit

  for (let i = 0; i < fcmTokens.length; i += CHUNK) {
    const chunk = fcmTokens.slice(i, i + CHUNK);
    // FCM requires all data values to be strings — coerce defensively
    const stringData: Record<string, string> = {};
    for (const [k, v] of Object.entries(msg.data ?? {})) {
      stringData[k] = String(v);
    }

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
        data: stringData,
      });

      successCount += res.successCount;

      res.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = r.error?.code ?? "";
        if (code === "messaging/mismatched-credential") {
          logger.error(
            { code, hint: "FIREBASE_SERVICE_ACCOUNT project does not match google-services.json — update credentials" },
            "FCM SENDER_ID_MISMATCH — wrong Firebase project on server",
          );
        } else {
          logger.warn({ code, token: chunk[idx] }, "FCM send failed for token");
        }
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

  return { stale, successCount };
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
   * Send a push to every registered device for a given role.
   * "customer" = broadcast promos to all customers.
   * "cashier"  = alert all cashier devices (new orders, customer chat pings).
   * Never mix these — a "cashier" caller must not accidentally hit customer rows.
   */
  async function sendPushToRole(role: "customer" | "cashier", msg: PushMessage): Promise<void> {
    try {
      const rows = await db
        .select()
        .from(pushTokensTable)
        .where(eq(pushTokensTable.role, role));

      logger.info(
        { role, tokenCount: rows.length, tokens: rows.map((r) => r.token) },
        "sendPushToRole — resolved target tokens for role",
      );

      if (rows.length === 0) {
        logger.warn({ role }, "No push tokens registered for role — broadcast skipped");
        return;
      }

      const rowsWithFCM = rows.filter((r) => !!r.fcmToken);
      const fcmTokens = rowsWithFCM.map((r) => r.fcmToken as string);

      const expoOnlyTokens = rows
        .filter((r) => !r.fcmToken)
        .map((r) => r.token)
        .filter((t): t is string => !!t && t.startsWith("ExponentPushToken["));

      logger.info(
        { role, fcm: fcmTokens.length, expo: expoOnlyTokens.length },
        "Sending role broadcast",
      );

      // Run FCM and Expo-only in parallel
      const [fcmResult, staleExpoOnly] = await Promise.all([
        sendViaFCM(fcmTokens, msg),
        sendViaExpo(expoOnlyTokens, msg),
      ]);

      // If FCM failed to deliver any messages (e.g. wrong Firebase project),
      // fall back to Expo Push API using the associated Expo tokens
      let expoFallbackTokens: string[] = [];
      if (fcmResult.successCount < fcmTokens.length) {
        expoFallbackTokens = rowsWithFCM
          .map((r) => r.token)
          .filter((t): t is string => !!t && t.startsWith("ExponentPushToken["));
        if (expoFallbackTokens.length > 0) {
          logger.warn(
            { role, fcmSent: fcmResult.successCount, fcmTotal: fcmTokens.length, fallback: expoFallbackTokens.length },
            "FCM partial failure — falling back to Expo Push API",
          );
        }
      }

      const [staleExpoFallback] = await Promise.all([
        expoFallbackTokens.length > 0 ? sendViaExpo(expoFallbackTokens, msg) : Promise.resolve([]),
        removeStaleByFCMToken(fcmResult.stale),
        removeStaleExpoTokens(staleExpoOnly),
      ]);

      await removeStaleExpoTokens(staleExpoFallback);
    } catch (err) {
      logger.error({ err, role }, "Error in sendPushToRole");
    }
  }

  /**
   * Broadcast to all registered customer devices (e.g. promo announcements).
   */
  export async function sendPushToAll(msg: PushMessage): Promise<void> {
    return sendPushToRole("customer", msg);
  }

  /**
   * Broadcast to all registered cashier devices (e.g. new order alerts,
   * customer -> cashier chat messages when no driver is assigned).
   */
  export async function sendPushToCashiers(msg: PushMessage): Promise<void> {
    return sendPushToRole("cashier", msg);
  }

/**
 * Send a notification to a specific device identified by its Expo token.
 * Primary: Firebase Admin SDK (FCM) if an fcmToken is stored for this device.
 * Fallback: Expo Push API when FCM is unavailable or fails (e.g. credential mismatch).
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

    let fcmDelivered = false;
    if (fcmToken) {
      const result = await sendViaFCM([fcmToken], msg);
      await removeStaleByFCMToken(result.stale);
      fcmDelivered = result.successCount > 0;
    }

    // Fall back to Expo Push API when FCM is not available or failed
    if (!fcmDelivered && expoToken.startsWith("ExponentPushToken[")) {
      if (fcmToken) {
        logger.warn({ expoToken }, "FCM failed — falling back to Expo Push API");
      }
      const stale = await sendViaExpo([expoToken], msg);
      await removeStaleExpoTokens(stale);
    } else if (!fcmDelivered && !expoToken.startsWith("ExponentPushToken[")) {
      logger.warn({ expoToken }, "No valid delivery token — targeted push skipped");
    }
  } catch (err) {
    logger.error({ err }, "Error in sendPushToToken");
  }
}
