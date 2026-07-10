---
name: EAS FCM V1 SenderId mismatch diagnosis
description: How to diagnose and fix Expo push notifications failing in production APK while working in Expo Go dev
---

If push notifications work in Expo Go dev but silently fail for all production Play Store users, check whether the EAS-side FCM V1 Google Service Account is linked to the SAME Firebase project as the `google-services.json` bundled in the app — they can drift independently (e.g. an old placeholder Firebase project left over from initial EAS setup).

**Why:** `eas credentials -p android` stores FCM V1 credentials separately per EAS project, decoupled from the `google-services.json` file referenced in `app.json`. If they point to different Firebase projects, Google rejects the push with `SENDER_ID_MISMATCH` (403) — this only shows up in the Expo push *receipt* (via `POST https://exp.host/--/api/v2/push/getReceipts`), not in the initial send response, which reports `status: "ok"` regardless.

**How to apply:**
- To check: run `eas credentials -p android`, pick the build profile, and compare the "Push Notifications (FCM V1)" Project ID against the `project_id` in `google-services.json`.
- To test end-to-end without needing shell/device access: send a push directly via `POST https://exp.host/--/api/v2/push/send` to a real registered token, then poll `getReceipts` with the returned ticket id — the `details.fcm.response` field reveals the real Google-side error.
- `eas credentials` is a fully interactive TUI (no non-interactive flags); it can be scripted with Python `pexpect` (arrow keys are `\x1b[B`/`\x1b[A`, `sendline('')` submits) when no human is available to click through it.
- To fix: upload the correct service account JSON via credentials menu → Google Service Account → Upload a Key, then Manage → "Select an existing key" and pick the one matching the app's actual Firebase project. No new app build is required — EAS credentials apply immediately server-side.
