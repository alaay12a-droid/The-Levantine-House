---
name: EAS Submit credential exclusivity
description: Why a valid iOS build can fail before submission when Expo stores conflicting Apple credentials.
---

For iOS submission, the Expo project must use one non-interactive App Store Connect authentication method. An App-Specific Password and an App Store Connect API Key cannot both be supplied to the same submission request.

**Why:** EAS can reject the request at GraphQL creation time with an exclusive-peers conflict before any submission workflow starts. Changing `eas.json` alone does not remove stale credentials stored remotely in the Expo account.

**How to apply:** Keep the submit profile limited to app identity when using Expo-managed credentials. If the exclusive-peers error remains, resolve the stored Apple credential selection in the account-bound Publish/credentials flow before retrying the existing build.