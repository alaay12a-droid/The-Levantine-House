---
name: EAS iOS submit authentication
description: Choosing one non-conflicting Apple authentication method for EAS iOS submission.
---

Use exactly one authentication method when submitting an iOS build: an App Store Connect API key or an Apple app-specific password.

**Why:** EAS rejects a submission before upload when both methods are projected into the same request, reporting a conflict between the app-specific password and App Store Connect API-key fields.

**How to apply:** Prefer the existing App Store Connect API key for non-interactive submission. Remove or disable the app-specific-password input for that submission, while preserving the confirmed App Store Connect app identifier and Apple team.