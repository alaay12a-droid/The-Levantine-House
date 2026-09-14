---
name: Sunmi printer duplicate prevention
description: Records the required post-print behavior for the standalone restaurant printer.
---

The standalone Sunmi printer must not update order status after printing. Keep the server-side order in `preparing` and persist printed order IDs locally on the device to prevent repeat prints.

**Why:** The current orders API does not support a `printed` status, and changing to `ready` or `done` would incorrectly advance the restaurant workflow. The user explicitly chose local tracking instead.

**How to apply:** Load the local printed-ID ledger before polling. Add an ID only after the printer confirms success, serialize printing, and never call the order-status endpoint from the printer app.