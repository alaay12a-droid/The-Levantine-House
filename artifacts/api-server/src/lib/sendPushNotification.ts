import { db, pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

interface PushMessage {
  title: string;
  body: string;
  sound?: "default";
  data?: Record<string, string>;
  channelId?: string;
}

function getFirebaseApp(): App {
  if (getApps().length > 0) return getApp();
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
  const serviceAccount = JSON.parse(raw) as ServiceAccount;
  return initializeApp({ credential: cert(serviceAccount) });
}

async function sendViaFCM(tokens: string[], msg: PushMessage): Promise<string[]> {
  if (tokens.length === 0) return [];
  const messaging = getMessaging(getFirebaseApp());
  const invalidTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title: msg.title, body: msg.body },
        android: {
          priority: "high",
          notification: {
            channelId: msg.channelId ?? "orders",
            sound: msg.sound ?? "default",
            defaultVibrateTimings: true,
          },
        },
        data: msg.data ?? {},
      });
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code ?? "";
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(chunk[idx]!);
          }
          logger.warn({ code, token: chunk[idx] }, "FCM send failed for token");
        }
      });
      logger.info({ success: response.successCount, fail: response.failureCount }, "FCM multicast sent");
    } catch (err) {
      logger.error({ err }, "FCM multicast error");
    }
  }
  return invalidTokens;
}

async function removeStaleTokens(fcmTokens: string[]): Promise<void> {
  for (const fcmToken of fcmTokens) {
    try {
      await db
        .update(pushTokensTable)
        .set({ fcmToken: null })
        .where(eq(pushTokensTable.fcmToken, fcmToken));
    } catch (err) {
      logger.warn({ err, fcmToken }, "Failed to remove stale FCM token");
    }
  }
}

export async function sendPushToAll(msg: PushMessage): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(pushTokensTable)
      .where(eq(pushTokensTable.role, "customer"));
    if (rows.length === 0) return;
    const fcmTokens = rows.map((r) => r.fcmToken).filter((t): t is string => !!t);
    if (fcmTokens.length === 0) {
      logger.warn("No FCM tokens registered — broadcast skipped");
      return;
    }
    const stale = await sendViaFCM(fcmTokens, msg);
    await removeStaleTokens(stale);
  } catch (err) {
    logger.error({ err }, "Error in sendPushToAll");
  }
}

export async function sendPushToToken(expoToken: string, msg: PushMessage): Promise<void> {
  if (!expoToken) return;
  try {
    const [row] = await db
      .select()
      .from(pushTokensTable)
      .where(eq(pushTokensTable.token, expoToken))
      .limit(1);
    const fcmToken = row?.fcmToken;
    if (!fcmToken) {
      logger.warn({ expoToken }, "No FCM token for device — skipping");
      return;
    }
    const stale = await sendViaFCM([fcmToken], msg);
    await removeStaleTokens(stale);
  } catch (err) {
    logger.error({ err }, "Error in sendPushToToken");
  }
}
