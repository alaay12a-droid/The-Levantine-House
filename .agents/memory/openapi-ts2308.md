---
name: OpenAPI TS2308 collision and queryKey rules
description: Two recurring TypeScript errors when building dashboard/react-vite apps with Orval codegen
---

## TS2308: Module already exported member

Orval auto-generates `<OperationIdPascal>Body` Zod schema names in `api.ts`.
If a `components/schemas` entry has the same name, it collides on re-export.

**Rule:** Body components must use entity-shaped names, never operation-shaped:
- ❌ `DashboardLoginBody` (collides with `dashboardLogin` → `DashboardLoginBody`)
- ✅ `DashboardCredentials`
- ❌ `UpdateOrderStatusBody` (collides with `updateOrderStatus` → `UpdateOrderStatusBody`)
- ✅ `OrderStatusUpdate`
- ❌ `UpdateMenuItemBody` → ✅ `MenuItemUpdate`

**Why:** Orval emits two things: (1) a Zod schema `CreateNoteBody` in `generated/api.ts`, and (2) a TS interface via `$ref` component also named `CreateNoteBody` in `generated/types/`. The barrel `export *` from both causes TS2308.

## queryKey required in query options

All Orval-generated React Query hooks require `queryKey` when passing any query option:
```typescript
// ❌ Fails TS
useDashboardMe({ query: { retry: false } })

// ✅ Correct
useDashboardMe({ query: { retry: false, queryKey: getDashboardMeQueryKey() } })
```

**Why:** The generated hook type requires `queryKey` in `UseQueryOptions` — it's not optional when passing the query config object at all.
