---
name: iOS push APNs key missing from credentials.json
description: Why iOS push never worked in App Store builds and how it was fixed
---

## Root Cause

`credentials.json` had distribution certificate + provisioning profile but **no `pushKey` section**. The APNs Auth Key file (`certs/AuthKey_L3432Q48N5.p8`) existed and was whitelisted in `.easignore`, but was never referenced — so EAS never uploaded it to Expo's push service.

When backend called `exp.host/--/api/v2/push/send` with iOS ExponentPushTokens, Expo's servers had no APNs credentials for the project and silently failed to deliver.

## Fix Applied

Added `pushKey` to `credentials.json`:
```json
"pushKey": {
  "keyP8Path": "./certs/AuthKey_L3432Q48N5.p8",
  "keyId": "L3432Q48N5",
  "teamId": "27476VAG8Z"
}
```

Bumped `ios.buildNumber` from "3" → "4". Submitted new EAS iOS build (build ID: a24eb3d7).

## Key Info

- Team ID: `27476VAG8Z`
- APNs Key ID: `L3432Q48N5`
- Key file: `certs/AuthKey_L3432Q48N5.p8`
- Bundle ID: `com.rwabi.almndi`
- Provisioning profile: `aps-environment: production` ✅

**Why:** When `credentialsSource: "local"`, EAS reads only what's in `credentials.json`. Without pushKey, Expo Push Service has no APNs credentials → iOS push silently fails.

**How to apply:** If credentials.json is ever recreated, always include the pushKey section.
