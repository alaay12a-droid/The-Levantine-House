---
name: Standalone app isolation
description: Durable rules for keeping a forked restaurant app independent from the original deployment
---

The standalone app must never fall back to the original deployment's database, Firebase project, storage bucket, API URL, EAS project, or mobile application identifiers. Missing replacement configuration should disable the dependent feature or block the build rather than silently reusing legacy values.

**Why:** Reusing one of these values can route customer data, push notifications, uploads, or production builds into the original restaurant project. The fork was explicitly requested to be independent.

**How to apply:** When cloning or renaming this app, require a new Neon URL, Firebase service account, Google service files, EAS project, and public API URL. Keep legacy identifiers only in explicit rejection guards or historical notes, never as runtime defaults.