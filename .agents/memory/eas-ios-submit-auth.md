---
name: EAS iOS submit authentication
description: Choosing one non-conflicting Apple authentication method for EAS iOS submission.
---

Use exactly one authentication method when submitting an iOS build: an App Store Connect API key or an Apple app-specific password.

**Why:** EAS rejects a submission before upload when both methods are projected into the same request, reporting a conflict between the app-specific password and App Store Connect API-key fields.

For Git-triggered builds, EAS reads the remote Git ref rather than the local workspace. A local configuration fix has no effect until its commit is pushed, and the build's reported Git commit must be checked.

If a successfully built artifact from a confirmed clean remote commit still gets the same exclusive-peer GraphQL error, the app-specific password is being injected by EAS's server-side submit credentials rather than by local files or Replit environment variables.

**How to apply:** Prefer the existing App Store Connect API key for non-interactive submission. Commit and push credential-configuration changes before triggering a Git build, then verify the build's Git commit. If a clean build still fails with the conflict, stop local credential edits and escalate to Expo to clear the stale server-side submit credential.