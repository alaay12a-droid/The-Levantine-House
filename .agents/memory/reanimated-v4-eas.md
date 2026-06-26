---
name: reanimated v4 EAS build fixes
description: Exact package versions and babel config needed for expo-router v6 + reanimated v4 with EAS/yarn to build successfully on SDK 54
---

## Rule
For Expo SDK 54 + expo-router v6, you MUST include all of these or EAS yarn install / Bundle JS will fail:

### Correct versions (from workspace lockfile with expo@54.0.35)
- `expo-constants: "~18.0.0"` (NOT ~17.x — 18.0.13 is the actual installed version)
- `expo-linking: "~8.0.0"` (NOT ~7.x — 8.0.12 is the actual installed version)
- `react-native-reanimated: "~4.1.1"` (v4 required by expo-router v6; v3 causes bundle failure)
- `react-native-worklets: "~0.5.1"` (MUST be listed explicitly — yarn v1 does NOT auto-install peer deps; reanimated v4 needs this)

### babel.config.js for reanimated v4
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],  // NOT react-native-reanimated/plugin (removed in v4)
  };
};
```

### app.json
```json
{ "expo": { "newArchEnabled": true } }
```
New Architecture must be enabled for reanimated v4.

**Why:** reanimated v4 split the babel worklets plugin into a separate `react-native-worklets` package. The old `react-native-reanimated/plugin` path no longer exists in v4. yarn v1 (used by EAS with no lockfile) does NOT auto-install peer dependencies, so `react-native-worklets` must be an explicit direct dep.

**How to apply:** Any time you create or modify a rawabi-driver EAS build, verify all 4 packages are in package.json with these specifiers, and babel.config.js uses `react-native-worklets/plugin`.
