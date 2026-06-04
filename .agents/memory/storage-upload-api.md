---
name: Storage Upload API Pattern
description: Correct endpoint, field names, and blob upload pattern for the object storage upload flow
---

The correct pattern for uploading files to object storage in the Expo app:

**Endpoint**: `POST /storage/uploads/request-url` (NOT `/storage/upload-url`)
**Response field**: `uploadURL` (capital URL — NOT `uploadUrl`)

```ts
const urlRes = await fetch(`${API_BASE}/api/storage/uploads/request-url`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: `file-${Date.now()}.${ext}`, size: asset.fileSize ?? 0, contentType }),
});
const { uploadURL, objectPath } = await urlRes.json();
const imageBlob = await fetch(asset.uri).then(r => r.blob());
await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: imageBlob });
const finalUrl = `${API_BASE}/api/storage${objectPath}`;
```

**Why:** The old broken pattern at `handlePickEditDriverPhoto` used `apiPost("/storage/upload-url")` (404) and destructured `uploadUrl` (wrong case) and passed an object literal instead of a blob as the PUT body.
