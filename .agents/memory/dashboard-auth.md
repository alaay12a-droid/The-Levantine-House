---
name: Dashboard auth architecture
description: How the web dashboard authentication works — JWT cookies, admin seed, DB table setup
---

## Auth mechanism
- JWT stored in httpOnly cookie `dashboard_token` (7 days expiry)
- Secret: `DASHBOARD_JWT_SECRET` env var — **required**, no fallback (throws on missing)
- cookie-parser middleware added to `artifacts/api-server/src/app.ts`

## Routes
- `POST /api/dashboard/auth/login` — verifies bcrypt hash, sets cookie
- `GET /api/dashboard/auth/me` — reads cookie, returns DashboardUser
- `POST /api/dashboard/auth/logout` — clears cookie

## Admin seed
- `seedDashboardAdmin()` called in `artifacts/api-server/src/index.ts` on startup
- Idempotent — skips if admin already exists
- Credentials are set via environment variables, not hardcoded

## DB table
- `dashboard_users` table added to `lib/db/src/schema/index.ts`
- Created via `executeSql` directly (NOT drizzle push — push is interactive in this project)

**Why:** `pnpm --filter @workspace/db run push` prompts interactively for unique constraint truncation; use executeSql for new tables in automated flows.

## Frontend auth guard
- `Layout` component calls `useDashboardMe` with `retry: false`
- Redirects to `/login` in `useEffect` (NOT inline during render — that causes React setState-during-render warning)
