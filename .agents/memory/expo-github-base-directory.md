---
name: Expo GitHub monorepo base directory
description: Expo GitHub App build configuration for mobile apps stored below a monorepo root.
---

For an Expo project whose source is in a repository subdirectory, configure the Expo project's GitHub integration Base directory to that subdirectory. The root value `/` makes GitHub App builds inspect the monorepo package instead of the app's static app.json.

**Why:** A GitHub App build can report that `android.package` is missing even when the app's own app.json defines it, if the integration is pointed at the repository root.

**How to apply:** In the Expo project's GitHub settings, set Base directory to the app's repository-relative path (for this driver project, `/artifacts/rawabi-driver`) and then build from GitHub with the intended Android profile.