import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { logger } from "./logger.js";

let _messaging: Messaging | null = null;
const LEGACY_FIREBASE_PROJECT_ID = "rawabialmandi-4d78f";

type FirebaseServiceAccount = {
  project_id?: unknown;
  client_email?: unknown;
  private_key?: unknown;
};

function parseServiceAccount(raw: string): FirebaseServiceAccount | null {
  const trimmed = raw.trim();
  const candidates = [trimmed];

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    candidates.push(trimmed.slice(1, -1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === "string") {
        const nested: unknown = JSON.parse(parsed);
        return nested && typeof nested === "object"
          ? (nested as FirebaseServiceAccount)
          : null;
      }
      return parsed && typeof parsed === "object"
        ? (parsed as FirebaseServiceAccount)
        : null;
    } catch {
      // Try the next supported representation before reporting invalid JSON.
    }
  }

  return null;
}

/**
 * Prevent a copied deployment from silently sending notifications through the
 * original Rawabi Firebase project.  The new project id is intentionally read
 * from the secure service-account secret at runtime.
 */
export function validateFirebaseProjectIsolation(): void {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return;

  const serviceAccount = parseServiceAccount(raw);
  if (!serviceAccount) {
    logger.warn(
      "FIREBASE_SERVICE_ACCOUNT is not valid JSON — Firebase notifications are disabled until it is replaced",
    );
    return;
  }

  if (serviceAccount.project_id === LEGACY_FIREBASE_PROJECT_ID) {
    throw new Error(
      "Firebase isolation check failed: the configured service account belongs to the original Rawabi project",
    );
  }
}

export function getFCMMessaging(): Messaging | null {
  if (_messaging) return _messaging;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    logger.warn("FIREBASE_SERVICE_ACCOUNT not set — FCM disabled");
    return null;
  }

  try {
    const serviceAccount = parseServiceAccount(raw);
    if (!serviceAccount) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    }
    if (serviceAccount.project_id === LEGACY_FIREBASE_PROJECT_ID) {
      throw new Error(
        "Firebase isolation check failed: legacy Rawabi project credentials are not allowed",
      );
    }
    if (getApps().length === 0) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    _messaging = getMessaging();
    logger.info("Firebase Admin SDK initialised — FCM ready");
    return _messaging;
  } catch (err) {
    logger.error({ err }, "Failed to initialise Firebase Admin SDK");
    return null;
  }
}
