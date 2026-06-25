---
name: EAS build in Replit agent
description: How to trigger EAS builds from the Replit main agent environment where git is blocked
---

## Problem
EAS CLI uses `git archive` to package source before uploading to Expo servers.
Replit main agent blocks ALL git operations (even in /tmp), so plain `eas build` fails with:
`Destructive git operations are not allowed in the main agent.`

## Solution
Use `EAS_NO_VCS=1` environment variable — this tells EAS CLI to skip git-based archiving
and instead compress+upload the directory directly as a tarball.

```bash
cd artifacts/rawabi-driver
EAS_NO_VCS=1 eas build --platform android --profile preview --non-interactive
```

**Why:** `EAS_NO_VCS=1` is an officially supported EAS flag for CI/CD environments without git.
The project files are uploaded as a raw tarball instead of a git archive.

## Warnings
- EAS warns "not recommended without VCS" — safe to ignore for Replit builds
- First run downloads ~292 MB from node_modules into the archive. Add `.easignore` to exclude test/dev files for faster future uploads.
- Must run `eas init --force` first to create the Expo project if it doesn't exist yet.

## rawabi-driver project info
- EAS project: @021837ala/rawabi-driver
- projectId: 0c32b5e4-7c57-4c5a-b07e-57e5fd04043e
- Package: com.rwabi.driver
- Profile: preview → APK (internal distribution)
- API base env: EXPO_PUBLIC_API_BASE_URL=https://mandi-menu-1.replit.app
