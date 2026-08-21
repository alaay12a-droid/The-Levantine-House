---
name: Artifact identity stability
description: How to safely rename a registered Replit artifact without breaking its preview registration.
---

For an existing registered Replit artifact, preserve its immutable artifact ID and directory reference. Rename its visible title, workspace package name, and service command instead of editing the ID or moving the registered directory.

**Why:** Artifact metadata validation rejects immutable ID changes. Moving a registered directory or changing its ID risks orphaning the existing preview and requires a deliberate new-artifact migration.

**How to apply:** When an app needs a rebrand or package rename, update the artifact title and development command through the validated artifact metadata flow. Keep any legacy directory references only where they remain required by the registered artifact, lockfile importer, or build tooling.