---
name: Replit deployment healthcheck failure from mobile artifact
description: rawabi-menu (Expo mobile) had a production web server config that crashed deployments
---

## The rule
Remove `[services.production]` from any mobile artifact's artifact.toml. Mobile artifacts (kind = "mobile") must NOT have production build/run configurations — Replit's deployment system will try to run them as web servers, causing ERR_PNPM_RECURSIVE_RUN_FIRST_ and healthcheck failures that crash the whole deployment.

**Why:** When Replit deploys, it runs ALL artifact production configs. A mobile Expo app has no `build` or `serve` npm scripts, so pnpm fails with ERR_PNPM_RECURSIVE_RUN_FIRST_. The healthcheck then fails because the process never starts.

**How to apply:** If deployment fails with ERR_PNPM_RECURSIVE_RUN_FIRST_ and healthcheck failures, check all artifact.toml files for `[services.production]` sections in mobile artifacts.

## Fix applied
Removed from artifacts/rawabi-menu/.replit-artifact/artifact.toml:
```toml
[services.production]
build = [ "pnpm", "--filter", "@workspace/rawabi-menu", "run", "build" ]
run = [ "pnpm", "--filter", "@workspace/rawabi-menu", "run", "serve" ]
```
