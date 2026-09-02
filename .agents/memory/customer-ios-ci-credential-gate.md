---
name: Customer iOS CI credential gate
description: Why customer iOS builds can stop before EAS creates a build and which credential path is safe.
---

Non-interactive customer iOS builds require the App Store Connect API key stored in EAS to be linked to the correct Apple Team ID and team type. Do not fall back to the local provisioning profile unless its application identifier matches the current bundle identifier.

**Why:** The remote-credential path can stop by prompting for Apple Team ID or team type in CI. The currently available local provisioning profile belongs to a different bundle identifier, so using it would sign the wrong app and must be rejected.

**How to apply:** Repair or replace the App Store Connect API key for the current bundle in EAS, ensure the Apple team metadata is complete, then retry the production profile non-interactively. Confirm that a new EAS build record exists before attempting submission.