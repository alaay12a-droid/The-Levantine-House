---
name: Firebase multi-client config isolation
description: A Firebase google-services.json may contain multiple Android clients from one project and must be filtered by package when isolating apps.
---

When preparing Firebase configuration for an isolated mobile app, retain only the client entry whose Android package matches that app; shared project metadata is safe to retain, but another app's client entry should not be copied into the target configuration.

**Why:** Firebase configuration files can contain more than one client for the same project, so checking only the project ID can accidentally attach the wrong package's settings to a separate app.

**How to apply:** Validate the target package name and client count after creating or receiving a google-services.json file, especially when sibling apps share one Firebase project.