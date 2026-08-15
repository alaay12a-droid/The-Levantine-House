---
name: iOS Expo Push Credentials — Missing Root Cause & Fix
description: Why App Store build didn't receive push notifications and how it was fixed without a new build
---

## The Root Cause
`iosAppCredentials: []` on Expo's servers for project `75492716-d1d5-4871-bfd9-18c7ef3982c7`.
Expo Push Service had NO APNs credentials for `com.rwabi.almndi` (Bundle ID).

Using `credentialsSource: "local"` in eas.json only signs the BUILD — it does NOT auto-upload the APNs push key to Expo's Push Service. The push key must be uploaded separately via Expo API or EAS CLI.

## Why Expo Go Worked But App Store Didn't
- Expo Go uses bundle `host.exp.Exponent` → Expo's shared APNs credentials → delivery works
- App Store uses `com.rwabi.almndi` → no credentials on Expo servers → silent failure

## Fix Applied (no new build required)
Uploaded credentials via Expo GraphQL API using EXPO_TOKEN:
1. Created Apple Team `27476VAG8Z` → Expo ID `f6ee9cbf-1fcb-416a-80bb-1c7ead83c5e4`
2. Uploaded APNs push key `L3432Q48N5` from `certs/AuthKey_L3432Q48N5.p8` → Expo ID `4959deba-d574-4155-b86a-a3e2e1aad523`
3. Created `iosAppCredentials` for `com.rwabi.almndi` → Expo ID `f6955a2b-69d9-49e4-bed3-8eb9f91342e7`
4. Linked push key to credentials via `setPushKey` mutation

**Why:** `credentialsSource: "local"` = build-only. Push service credentials = separate upload.

**How to apply:** If push stops working after re-keying on Apple Developer Portal, re-upload the new p8 via the same GraphQL mutation flow (delete old key first, create new, setPushKey).

## Verification
After fix: `iosAppCredentials[0].pushKey.keyIdentifier = "L3432Q48N5"` confirmed via API.

## Post-Fix Testing Required
App Store users must reopen the app once to get a fresh push token after credentials are uploaded.
Token was already correctly reaching DB (hasPushToken: true) and Expo Push API was returning fail:0.
Receipt status after credential upload = unknown; next test order will confirm full end-to-end.

## Key Details
- Bundle ID: com.rwabi.almndi
- APNs Key: AuthKey_L3432Q48N5.p8 (certs/ dir), keyId: L3432Q48N5, teamId: 27476VAG8Z
- Expo Account: 021837ala (fe3e990d-c846-4363-9673-8bdb5a74c07d)
- Provisioning profile: aps-environment = production ✅, expires 2027-07-23
