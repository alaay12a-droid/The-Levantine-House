---
name: Firebase service-account validation
description: How to safely confirm a Firebase service-account secret was actually replaced.
---

**Rule:** Treat a Firebase credential as valid only after a server restart no longer logs the JSON parsing warning.

**Why:** Uploading a credential file to chat does not transfer its contents into the environment secret, and a secret-form confirmation can only prove the key exists. The complete raw JSON must be pasted into the secure secret field.

**How to apply:** Never inspect or print the credential. Ask the user to paste the full downloaded Service Account JSON in the secure field, restart the service, and use the startup log as the pass/fail check.