---
name: iOS push notifications — Expo fallback fix
description: Why iOS push was broken and how it was fixed without Firebase iOS setup
---

# iOS Push — Root Cause & Fix

## Root cause
`getDevicePushTokenAsync()` on iOS (without `GoogleService-Info.plist`) returns a raw APNs device token (64-char hex), NOT an FCM registration token. The old code stored it as `fcmToken`. Firebase Admin SDK rejected it with `messaging/invalid-registration-token`, which triggered `removeStaleByFCMToken` → this **deleted the entire row**, permanently killing the ExponentPushToken fallback too.

## Fix applied
1. **`removeStaleByFCMToken`** (sendPushNotification.ts) — changed from `db.delete()` to `db.update({ fcmToken: null })`. Row stays, Expo token survives.
2. **`useCustomerPushToken.ts` + `useNotifications.ts`** — `getDevicePushTokenAsync()` now only called on Android (`Platform.OS === "android"`). iOS devices register with Expo token only.
3. **`app.json`** — added `"remote-notifications"` to `UIBackgroundModes`.

## Result
iOS push now works via Expo Push API (which handles APNs internally). No Firebase iOS config needed.

**Why:** Expo Push API is the correct delivery path for iOS in Expo-managed builds. Firebase FCM for iOS requires `GoogleService-Info.plist` + APNs Auth Key — not yet configured.

**How to apply:** If Firebase iOS is ever configured (GoogleService-Info.plist + APNs key), re-enable `getDevicePushTokenAsync()` on iOS and revert `removeStaleByFCMToken` back to delete. Until then, keep iOS on Expo-only path.

## User action required
Existing iOS users whose rows were deleted must reopen the app once to re-register their Expo token. After that, push works automatically.
