---
name: EAS build in Replit agent
description: How to submit EAS builds from within the Replit pnpm monorepo environment without hitting git-lock, symlink, or disk-quota errors.
---

## The rule
Never run `eas build` directly from an artifact inside the pnpm workspace.
Run it from a **standalone copy in `/tmp/`** that has no `pnpm-workspace.yaml` above it.

## Why the direct approach fails
1. **Git mode blocked**: `git rev-parse` and archive creation require index-lock writes, which are blocked in the main Replit agent.
2. **EAS_NO_VCS=1 + pnpm symlinks = 293 MB archive**: EAS follows workspace symlinks in `node_modules/` out to the global `.pnpm` store, inflating the archive from ~6 MB to ~293 MB. `.easignore` at workspace root does NOT help reliably.
3. **EDQUOT (-122) error**: Home directory filesystem has a quota; compressing 293 MB hits it. `TMPDIR=/tmp` partially fixes this but compression still hangs.

## How to apply — step-by-step
```bash
# 1. Create a standalone copy (no node_modules)
mkdir /tmp/rawabi-standalone
cp -r artifacts/rawabi-driver/{app,assets,components,app.json,eas.json,package.json,babel.config.js,metro.config.js,tsconfig.json} /tmp/rawabi-standalone/
echo "node_modules/" > /tmp/rawabi-standalone/.easignore

# 2. Install dependencies (pnpm outside workspace = no symlinks to workspace root)
cd /tmp/rawabi-standalone && pnpm install --no-frozen-lockfile

# 3. Submit build (archive = ~5 MB, uploads in 2s)
TMPDIR=/tmp EAS_NO_VCS=1 eas build --platform android --profile preview --non-interactive
```

## SDK 54 correct package versions (from expo install --check)
| Package | Correct version |
|---|---|
| react-native | 0.81.5 |
| react-native-safe-area-context | ~5.6.0 |
| react-native-screens | ~4.16.0 |
| react-native-gesture-handler | ~2.28.0 |
| react-native-reanimated | ~4.1.1 |
| react | 19.1.0 |
| expo-location | ~19.0.8 |
| expo-font | ~14.0.12 |
| expo-status-bar | ~3.0.9 |
| expo-splash-screen | ~31.0.13 |
| @expo/vector-icons | ^15.0.3 |
| typescript | ~5.9.2 |

**Why:** Wrong versions (e.g. react-native 0.79.2 in an SDK 54 app) pass dev server startup but cause Gradle build failure in EAS.

## rawabi-driver project info
- EAS project: @021837ala/rawabi-driver
- projectId: 0c32b5e4-7c57-4c5a-b07e-57e5fd04043e
- Package: com.rwabi.driver
- Profile: preview → APK (internal distribution)
- API base env: EXPO_PUBLIC_API_BASE_URL=https://mandi-menu-1.replit.app
