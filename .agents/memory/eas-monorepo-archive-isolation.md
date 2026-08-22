---
name: EAS monorepo archive isolation
description: How pnpm workspace discovery can break an otherwise valid Expo mobile build on EAS
---

For an Expo app built from a pnpm monorepo, the EAS archive must exclude unrelated workspace packages that are not needed by the mobile app.

**Why:** EAS can run a second `pnpm install --no-frozen-lockfile` after Expo prebuild. If the archive contains an unrelated package with a missing `workspace:*` dependency, that reinstall fails before Android compilation even though the mobile package itself is valid.

**How to apply:** Keep the mobile app's project root and required lockfile/manifests in the archive, but add unrelated servers, dashboards, libraries, and other artifacts to the applicable `.easignore`. Verify the EAS log reaches Gradle before treating the build as healthy.