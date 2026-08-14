---
name: EAS build in Replit agent
description: How to submit EAS builds from within the Replit pnpm monorepo environment without hitting git-lock, symlink, or disk-quota errors.
---

## The rule
Run `eas build` from **inside the artifact directory** using `EAS_PROJECT_ROOT=$(pwd)`.
Do NOT use the /tmp/ standalone approach — npm/pnpm/yarn install all fail in Replit due to OOM.

## Why EAS_PROJECT_ROOT works
Without it, EAS uses `git rev-parse --show-toplevel` → workspace root → archives the entire pnpm store (269 MB).
With `EAS_PROJECT_ROOT=$(pwd)`, EAS uses the artifact dir as root → .easignore excludes node_modules → ~52 MB archive.

## How to apply — one command
```bash
cd artifacts/rawabi-menu
EAS_PROJECT_ROOT=$(pwd) TMPDIR=/tmp EAS_NO_VCS=1 EAS_BUILD_NO_EXPO_GO_WARNING=true \
  eas build --platform android --profile production --non-interactive
```
- Archive: ~51.6 MB (source + assets only)
- Upload: ~6 seconds
- Build runs on EAS servers (~20 min for Android)
- Use `eas build:view <build-id>` to poll status

## Why the /tmp/ standalone approach fails
npm/pnpm/yarn install in /tmp/ all exit with code -1 (OOM, no output). Replit doesn't have enough memory for full package installation outside the workspace.

## rawabi-menu iOS build — critical rules
- Always use `EAS_PROJECT_ROOT=$(pwd) EAS_NO_VCS=1` when running from inside `artifacts/rawabi-menu/`
- **Never add `"packageManager"` to root `package.json`** — it causes EAS to lose the monorepo project path; all iOS builds fail with "package.json does not exist in /Users/expo/workingdir/build/artifacts/rawabi-menu"
- Symptom of missing EAS_PROJECT_ROOT: build fails in PRE_INSTALL_HOOK within ~60 seconds with "package.json does not exist"
- **Never add `ios.entitlements.aps-environment` to app.json** — causes Apple error 90112 ("UIBackgroundModes contains invalid value: remote-notifications"); Expo reads push capability from the provisioning profile automatically; adding it explicitly conflicts and fails Apple validation

## .easignore location
Must be in `artifacts/rawabi-menu/.easignore` (already exists). Key entries: `node_modules/`, `dist/`, `server/`, `.expo/`.

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
