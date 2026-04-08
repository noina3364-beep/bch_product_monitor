# CODEX.md

This file gives Codex and other coding agents the minimum project context needed to work safely and quickly in this repository.

## Project Overview

- Project name: BCH Product Monitor
- Stack: Vite, React 19, TypeScript, Tailwind CSS v4, Express, Prisma, SQLite, Lucide icons
- App shape: single-page dashboard for monitoring products, funnels, channels, visits, and revenue
- Frontend state model: `src/context/ProductContextV2.tsx` hydrates from the backend API and keeps the UI in sync after auth is established
- Backend: Express API in `server/src` with Prisma schema in `prisma/schema.prisma`
- Persistence: SQLite database at `prisma/dev.db`
- Authentication: cookie-backed sessions with Editor and Viewer roles
- Deployment origin: this repo appears to be exported from Google AI Studio

## Useful Commands

- Install dependencies: `npm install`
- Start frontend dev server: `npm run dev`
- Start backend dev server: `npm run dev:server`
- Type-check: `npm run lint`
- Production build: `npm run build`
- Preview build: `npm run preview`
- Generate Prisma client: `npm run prisma:generate`
- Apply Prisma schema to SQLite: `npm run prisma:push`
- Seed database: `npm run prisma:seed`

Windows helper scripts:

- First-time install: `install.bat`
- First-time initialize: `init.bat`
- Regular update after pulling new code: `update.bat`
- Regular start: `start.bat`
- Stop frontend/backend started by `start.bat`: `stop.bat`
- Change the Editor password: `set-password.bat`

Notes:

- `npm run lint` runs `tsc --noEmit`; there is no ESLint setup in this repo yet.
- `npm run clean` removes both `dist` and `build` with a Node-based script.
- `npm run prisma:push` uses `prisma/push.ts` rather than `prisma db push` directly because that is more reliable in this Windows environment.
- `start.bat` is now a thin wrapper around `scripts/start-dev.ps1`.
- `stop.bat` is now a thin wrapper around `scripts/stop-dev.ps1`.
- `start-dev.ps1` regenerates the Prisma client, applies schema updates, checks ports `3000` and `3001`, and seeds only on first run.
- `stop-dev.ps1` stops tracked dev processes and also kills anything still listening on ports `3000` and `3001`.
- `init.bat` is destructive and reseeds the local SQLite database.
- `update.bat` is non-destructive and should be preferred for normal project upgrades.
- `set-password.bat` runs `npm run auth:set-password`.

## Environment

Expected environment variables are documented in `.env.example`:

- `DATABASE_URL`
- `PORT`
- `CLIENT_ORIGIN`
- `VITE_API_BASE_URL`
- `GEMINI_API_KEY`
- `APP_URL`

For local work, follow the README and place the needed values in `.env` or `.env.local`.

## Architecture

### Entry flow

- `src/main.tsx` mounts the app
- `src/App.tsx` wraps the UI in `AuthProvider`
- `AuthenticatedApp` waits for session state and shows `LoginPage` until authenticated
- Logged-in users then enter `ProductProvider`
- `DashboardContent` decides between:
  - `DashboardAuth` when no product is selected
  - `MonitoringTableAuth` when a product is active

### Core state

`src/context/ProductContextV2.tsx` is the main source of truth for:

- `products`
- `activeProduct`
- `globalTargets`
- frontend loading/error state
- API-backed mutations for products, funnels, channels, cell values, layout width, reorder, duplicate, and backup import/export

When changing frontend data behavior, update the provider first and keep components thin.

`src/context/AuthContext.tsx` is the auth source of truth for:

- current auth session
- Editor and Viewer login flows
- logout flow
- role helpers such as `isEditor`
- resetting to logged-out state on `401`

### Backend flow

- `server/src/index.ts` exposes REST endpoints under `/api`
- `server/src/auth.ts` handles password hashing, cookie sessions, and auth middleware
- `server/src/data_v2.ts` contains the active mapping and mutation helpers for the new UX/data model
- Prisma models live in `prisma/schema.prisma`
- Seed data lives in `prisma/seed-data.ts`

### Data model

Types live in `src/types/index.ts`.

Important shape:

- A `Product` has shared `funnels` and `channels`
- Each product now also stores:
  - `position`
  - `layout.channelColumnWidth`
- Each funnel now has category-specific targets:
  - `targets.newChannels`
  - `targets.existingChannels`
- Each funnel also stores:
  - `position`
  - `parentFunnelId`
- Each channel stores `position`
- Metric data is split into two categories:
  - `newChannels`
  - `existingChannels`
- Each category is keyed as `funnelId -> channelId -> { visits, revenue }`

Backend persistence detail:

- Prisma stores funnel targets in `funnel_targets`
- Prisma stores product ordering and channel header width on `products`
- Prisma stores funnel ordering and funnel parent relationships on `funnels`
- Prisma stores auth users in `users`
- Prisma stores auth sessions in `sessions`
- Current schema keeps:
  - `targetVisits` as a legacy/shared fallback for older databases
  - `newTargetVisits`
  - `existingTargetVisits`
- Backend DTO mapping returns only the frontend shape with `targets.newChannels` and `targets.existingChannels`

Auth detail:

- Roles are `editor` and `viewer`
- Session cookie name is `bch_pm_session`
- Sessions live in SQLite, not JWTs
- Viewer is guest-like and enters through the login page button
- Default seeded Editor credentials:
  - username: `editor`
  - password: `ChangeMe123!`
- `set-password.bat` updates the existing Editor user in SQLite without reseeding the app.
- Running `init.bat` later will reset the seeded Editor password back to the default.

## Implementation Notes

- Keep the frontend product shape aligned with the backend DTO shape returned by `/api/products/:productId/dashboard`.
- When changing funnel target behavior, update all three layers together:
  - `src/types/index.ts`
  - backend DTO mapping in `server/src/data_v2.ts`
  - Prisma schema and seed data
- Funnel conversion is no longer based on adjacent columns.
  - Use `funnel.parentFunnelId`
  - Reordering funnels changes display order only, not parent relationships
- Keep `newChannels` and `existingChannels` structurally in sync when adding or removing funnels/channels.
- `activeProduct === null` is meaningful UI state and should continue to show the overview dashboard.
- Most frontend updates are optimistic and then reconciled with the server response; avoid changing response shapes casually.
- Product duplication is a full copy:
  - funnels
  - channels
  - both category targets
  - input values
  - parent relationships
  - positions
  - channel column width
- Backup/import is full-app JSON:
  - export from `/api/backup/export`
  - import to `/api/backup/import`
  - import is replace-all, not merge
- Local images live in `public/images/`.
  - Sidebar logo: `public/images/B.png`
  - Dashboard logo: `public/images/Chan.png`
- Styling is utility-first Tailwind directly in components; match the existing visual language unless the task is a deliberate redesign.
- Viewer mode should be truly read-only:
  - hide add/edit/delete/duplicate/reorder/resize/import/export controls
  - render targets, names, and cell values as display-only UI
  - keep backend `403` protection in place for all mutating routes
- Current product-table behavior:
  - top controls stay above the table
  - the channel name column stays sticky on horizontal scroll
  - the channel header row and `Performance Summary` row are not frozen and should scroll vertically with the rest of the table
  - per-cell conversion percentage should remain visually highlighted as a badge next to the `Conv from ...` label
  - product-page revenue symbol should render as `฿`
- SQLite writes and some dev-server commands can fail inside restricted environments; in those cases prefer the batch files or unsandboxed local runs.
- If a user reports `node.exe` startup problems, check whether port `3001` is already occupied before assuming the backend build is broken.
- If a helper batch file becomes fragile, prefer moving the real logic into a PowerShell script and keeping the `.bat` as a thin wrapper.

## Database Access

- Main SQLite file: `prisma/dev.db`
- Useful options:
  - `npx prisma studio`
  - SQLite GUI tools such as DB Browser for SQLite / SQLiteStudio / DBeaver
  - `sqlite3 prisma/dev.db` if the SQLite CLI is installed

Main tables:

- `products`
- `funnels`
- `funnel_targets`
- `channels`
- `input_values`
- `dashboard_targets`
- `users`
- `sessions`

## Files To Check Before Major Changes

- `src/context/ProductContextV2.tsx`
- `src/context/AuthContext.tsx`
- `src/components/LoginPage.tsx`
- `src/components/DashboardAuth.tsx`
- `src/components/MonitoringTableAuth.tsx`
- `src/components/SidebarV2.tsx`
- `src/components/ConfirmationDialog.tsx`
- `src/components/AutosizeTextarea.tsx`
- `src/lib/api.ts`
- `src/types/index.ts`
- `server/src/index.ts`
- `server/src/auth.ts`
- `server/src/data_v2.ts`
- `server/src/validators.ts`
- `prisma/schema.prisma`
- `prisma/seed-data.ts`
- `prisma/seed.ts`
- `start.bat`
- `set-password.bat`
- `scripts/start-dev.ps1`
- `scripts/stop-dev.ps1`
- `scripts/set-editor-password.mjs`

## Agent Working Agreement

- Prefer small, localized changes over broad rewrites.
- Verify with `npm run lint` after meaningful TypeScript changes.
- Run `npm run build` when changes could affect bundling or runtime behavior.
- If you change the API or data model, update Prisma schema, backend DTO mapping, and frontend context expectations together.
- If you add persistence or API calls, document the new flow in `README.md` and this file.
- If you change startup or login behavior, update the helper batch scripts and the bootstrap credential notes too.

## Known Gaps

- No automated tests are present.
- Some local dev commands need to run outside the sandbox because Vite/esbuild and SQLite writes can be restricted here.
- Batch files are the expected Windows entrypoints for non-technical users; if startup/setup behavior changes, update them too.
- Legacy files such as `src/context/ProductContext.tsx`, `src/components/MonitoringTable.tsx`, `src/components/Sidebar.tsx`, `src/components/Dashboard.tsx`, `src/components/MonitoringTableV2.tsx`, and `server/src/data.ts` may still exist, but the active app is wired to the auth-aware files listed above.
- README may still lag behind product-specific UX decisions if the app changes quickly.
