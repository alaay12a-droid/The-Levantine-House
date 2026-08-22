---
name: Replit Expo Android publishing limitation
description: Replit's built-in Expo Launch flow currently supports iOS/App Store publishing, not Android builds or Google Play delivery.
---

Replit's Expo Launch publishing flow is currently for iOS/App Store submission; Android APK/AAB publishing is not supported there.

**Why:** The Expo skill explicitly disallows EAS CLI and the Replit environment may not have Java or Android SDK installed, so Android builds cannot be started reliably from the agent shell.

**How to apply:** For Android APK/AAB, use a supported external/CI build path only with the user's approval; do not promise a Replit Expo Launch Android build or run EAS commands.