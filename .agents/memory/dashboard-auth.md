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

## Admin seed (FIXED — do not revert)
- `seedDashboardAdmin()` called in `artifacts/api-server/src/index.ts` on startup
- **Current behavior: only seeds on first run (INSERT if no admin exists). Skips if admin already exists.**
- Old behavior was: ALWAYS update password from env var on every restart → erased OTP resets
- Credentials source: `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars — values managed outside memory

**Why this matters:** The old overwrite behavior created an unbreakable loop — user resets password via OTP, server restarts, password reverts to env var value. Fix: seed is now insert-only.

## DB table
- `dashboard_users` table added to `lib/db/src/schema/index.ts`
- Created via `executeSql` directly (NOT drizzle push — push is interactive in this project)

**Why:** `pnpm --filter @workspace/db run push` prompts interactively for unique constraint truncation; use executeSql for new tables in automated flows.

## Frontend auth guard
- `Layout` component calls `useDashboardMe` with `retry: false`
- Redirects to `/login` in `useEffect` (NOT inline during render — that causes React setState-during-render warning)

## OTP input field pitfall
- shadcn `FormControl` uses Radix `Slot` which clones the child and injects props (id, aria-invalid, ref)
- This breaks Android Chrome keyboard input on custom OTP components wrapped in FormControl
- **Fix**: use plain native `<input type="tel">` with local `useState` — NO FormControl/Slot/Controller wrapper
- Validate OTP manually before API call, do not use react-hook-form Controller for OTP field

## Resetting production admin password
- `executeSql` is read-only for production environment — cannot write to prod DB via tool
- To reset prod admin password: Republish first, then use OTP forgot-password flow in browser
