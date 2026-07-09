---
name: Driver background-location disclosure gate
description: How the in-app Google Play prominent-disclosure screen is wired before requesting Android location permissions in rawabi-driver
---

The disclosure modal must be shown and explicitly accepted (tap "Continue") before `Location.requestForegroundPermissionsAsync` / `requestBackgroundPermissionsAsync` are ever called, and only for the driver role (this app has no other role, so the whole app qualifies).

**Why:** Google Play rejected the app for missing Prominent Disclosure & Consent before requesting `ACCESS_BACKGROUND_LOCATION`. The permission calls live inside `startGPS`, which is triggered automatically by a `useEffect` reacting to order status — not by direct user action — so the gate has to live inside `startGPS` itself (check an accepted-flag ref first, short-circuit and show the modal, resume via a "pending order id" ref once the user accepts) rather than at the call site.

**How to apply:** Acceptance is persisted once via AsyncStorage (`driver_location_disclosure_accepted_v1`) so it isn't re-shown every delivery — Play policy requires disclosure before requesting, not disclosure every single time. If wording changes, bump the storage key version so existing installs re-consent to the new text.
