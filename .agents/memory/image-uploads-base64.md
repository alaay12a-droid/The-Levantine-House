---
name: Image uploads use base64-in-DB, not object storage
description: Rawabi image upload pipeline (menu items, driver photos) stores images as compressed base64 data URLs directly in Postgres text columns instead of GCS/Firebase/Replit object storage.
---

Decision: product and driver photo uploads are stored as compressed base64 `data:` URLs directly in the `image_url`/`photo_url` text columns, not in any external object storage bucket.

**Why:** The Firebase project backing this app (rawabialmandi-4d78f) has no GCP billing account, so `storage.createBucket()` / signed-URL flows fail with a 403 "billing account disabled/absent" — a hard Google Cloud requirement that cannot be fixed with code or credentials alone. The user explicitly rejected setting up billing and asked for uploads to work without any new paid infrastructure. Replit's own object-storage sidecar is also unavailable on Render (production host), where this app is deployed.

**How to apply:** Any new image upload feature in this app should reuse the existing base64 compression helper (client-side resize to ~1024px, JPEG quality ~0.8) rather than reintroducing GCS/Firebase/object-storage signed-URL flows. `imageUrl`/`photoUrl` DB columns are unbounded `text`, so this is safe. Legacy rows seeded before this change may still contain old broken object-storage/Replit-dev-domain URLs — those are pre-existing and not fixed by this approach; treat missing images on old items as expected until manually replaced.
