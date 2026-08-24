---
name: Apple SMS 2FA throttling
description: Apple can temporarily prevent EAS from requesting another SMS verification code while refreshing iOS credentials.
---

When Apple Developer Portal reports that verification codes cannot be sent to the phone number at this time, stop EAS credential attempts and wait for Apple to allow a new code before retrying. A code that was already received cannot complete a new EAS login attempt if Apple rejects the request that initiates the verification session.

**Why:** Repeated EAS Apple-login attempts can trigger an Apple-side SMS throttle before EAS reaches the code-entry prompt, which blocks provisioning-profile regeneration even when the code is stored securely.

**How to apply:** Do not retry in a loop or ask the user to paste codes in chat. After Apple sends a fresh code again, update it through the secrets form and run one carefully controlled EAS credentials session; then regenerate the invalid provisioning profile and build.