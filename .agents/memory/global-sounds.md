---
name: Global Sound Settings Architecture
description: How admin-set sound preferences are propagated globally to all devices without rebuild
---

Sound settings flow:
1. **Server**: `GET/PUT /settings/sounds` in `appearance.ts` — stores in `appSettingsTable` with `sound_` prefix
2. **Startup**: `AppConfigContext` calls `/settings/sounds` on app boot, writes result into AsyncStorage using `SOUND_KEYS.*`
3. **Playback**: `useAppSound` / `playAppSound` reads from AsyncStorage as usual — no hook changes needed
4. **Admin save**: `setSoundPref` in admin-menu.tsx calls `apiPut("/settings/sounds", ...)` after AsyncStorage update
5. **Custom URL**: Admin enters a URL in the custom sound modal → saved to AsyncStorage + server via `customOrderUrl / customMessageUrl / customDeliveryUrl`

**Why:** sounds were previously per-device (AsyncStorage only). To make admin changes global, we push to the server and have AppConfigContext overwrite AsyncStorage on startup. No changes needed to `useAppSound` since it still reads from AsyncStorage.

**How to apply:** Any new sound event type (e.g. new_message) needs: SOUND_KEYS entry → server key in SOUND_DEFAULTS → GET/PUT handler → AppConfigContext load line → admin-menu state + setSoundPref branch.
