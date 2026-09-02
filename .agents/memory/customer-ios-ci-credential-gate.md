---
name: Customer iOS CI credential gate
description: Why customer iOS builds can stop before EAS creates a build and which credential path is safe.
---

Non-interactive customer iOS builds require the App Store Connect API key stored in EAS to be linked to the correct Apple Team ID and team type, plus an active remote provisioning profile for the current bundle identifier. Do not fall back to a local profile unless its application identifier matches.

**Why:** Reassigning a valid API key alone did not stop the Team ID prompt. Once the team metadata was supplied and EAS created a matching remote profile, the non-interactive build proceeded even though credential validation still logged an authentication warning. A mismatched local profile would sign the wrong app.

**How to apply:** Validate the API key against Apple, assign it to the bundle in EAS, supply the correct team type and Team ID once, and create/assign a remote App Store profile. Treat “All credentials are ready” and an actual queued build as the success gate.