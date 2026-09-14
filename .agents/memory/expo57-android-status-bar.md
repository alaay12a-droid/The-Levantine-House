---
name: Expo 57 Android status bar configuration
description: Records the SDK 57 replacement for removed or deprecated Android app-config fields.
---

In Expo SDK 57, do not set `android.edgeToEdgeEnabled` in app config; Expo Doctor rejects it as an unknown property. Do not use the deprecated top-level `androidStatusBar` block either. Render `StatusBar` from `expo-status-bar` and rely on SDK 57's Android edge-to-edge defaults.

**Why:** Expo Doctor and Prebuild reject or warn on the older config fields even though they were valid in earlier Expo SDK versions.

**How to apply:** For SDK 57 mobile artifacts, configure status-bar style in the React tree with `expo-status-bar`, and leave edge-to-edge behavior to the SDK default unless the current Expo schema documents a replacement.