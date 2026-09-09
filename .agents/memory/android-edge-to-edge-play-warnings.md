---
name: Android edge-to-edge Play warnings
description: Distinguishes app-owned Android 15 compatibility work from deprecated API references bundled by Expo and React Native.
---

For Expo SDK 54, use the supported edge-to-edge app configuration and safe-area insets; remove app-owned status/navigation bar color and translucency requests that Android 15 deprecates.

**Why:** Google Play can still statically report `Window` system-bar APIs from React Native or Expo native modules even after the app itself is correctly configured. The warning alone does not prove edge-to-edge is disabled or content overlaps.

**How to apply:** Verify generated Gradle edge-to-edge properties, audit app-owned calls separately from dependency code, and test insets on an Android 15+ device. Do not patch or broadly upgrade dependencies solely to hide an upstream scanner warning.