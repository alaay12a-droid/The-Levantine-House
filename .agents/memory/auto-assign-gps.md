---
name: Auto-assign driver GPS source
description: Where driver GPS comes from for the auto-assign feature; why delivery_drivers needs its own location columns
---

## Rule
Driver GPS is only written to `order_driver_assignments.driver_lat/lng/location_updated_at` during an active order. Free drivers (no active assignment) have no GPS record anywhere unless you store it separately.

**Why:** The auto-assign feature needs each driver's last known location even when they're idle. To solve this, we added `last_lat`, `last_lng`, `last_location_at` to `delivery_drivers` and update them inside `PUT /orders/:id/driver-location` (fire-and-forget after `res.json`).

**How to apply:**
- Whenever you need a driver's current location (not tied to an order), query `delivery_drivers.last_lat/lng`.
- A location older than 15 minutes is treated as stale and the driver is ineligible for auto-assign.
- The migration is safe (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`), already in `artifacts/api-server/src/index.ts`.
- The Drizzle schema fields are `lastLat`, `lastLng`, `lastLocationAt` on `deliveryDriversTable` (`lib/db/src/schema/index.ts`).

## Hardcoded restaurant coordinates
`RESTAURANT_LAT = 28.410769`, `RESTAURANT_LNG = 36.532353` — defined in two places: `artifacts/api-server/src/routes/drivers.ts` (tracking page: line ~712, auto-assign endpoint: local constant). If the restaurant moves, both must be updated. No DB setting exists yet.
