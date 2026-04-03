# CODEX.md

This file gives Codex and other coding agents the minimum project context needed to work safely and quickly in this repository.

## Project Overview

- Project name: BCH Product Monitor
- Stack: Vite, React 19, TypeScript, Tailwind CSS v4, Express, Prisma, SQLite, Lucide icons
- App shape: single-page dashboard for monitoring products, funnels, channels, visits, and revenue
- Frontend state model: `src/context/ProductContext.tsx` hydrates from the backend API and keeps the UI in sync
- Backend: Express API in `server/src` with Prisma schema in `prisma/schema.prisma`
- Persistence: SQLite database at `prisma/dev.db`
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

Notes:

- `npm run lint` runs `tsc --noEmit`; there is no ESLint setup in this repo yet.
- `npm run clean` removes both `dist` and `build` with a Node-based script.
- `npm run prisma:push` uses `prisma/push.ts` rather than `prisma db push` directly because that is more reliable in this Windows environment.

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
- `src/App.tsx` wraps the UI in `ProductProvider`
- `DashboardContent` decides between:
  - `Dashboard` when no product is selected
  - `MonitoringTable` when a product is active

### Core state

`src/context/ProductContext.tsx` is the main source of truth for:

- `products`
- `activeProduct`
- `globalTargets`
- frontend loading/error state
- API-backed mutations for products, funnels, channels, and cell values

When changing frontend data behavior, update the provider first and keep components thin.

### Backend flow

- `server/src/index.ts` exposes REST endpoints under `/api`
- `server/src/data.ts` contains the main mapping and mutation helpers
- Prisma models live in `prisma/schema.prisma`
- Seed data lives in `prisma/seed-data.ts`

### Data model

Types live in `src/types/index.ts`.

Important shape:

- A `Product` has shared `funnels` and `channels`
- Each funnel now has category-specific targets:
  - `targets.newChannels`
  - `targets.existingChannels`
- Metric data is split into two categories:
  - `newChannels`
  - `existingChannels`
- Each category is keyed as `funnelId -> channelId -> { visits, revenue }`

Backend persistence detail:

- Prisma stores funnel targets in `funnel_targets`
- Current schema keeps:
  - `targetVisits` as a legacy/shared fallback for older databases
  - `newTargetVisits`
  - `existingTargetVisits`
- Backend DTO mapping returns only the frontend shape with `targets.newChannels` and `targets.existingChannels`

## Implementation Notes

- Keep the frontend product shape aligned with the backend DTO shape returned by `/api/products/:productId/dashboard`.
- When changing funnel target behavior, update all three layers together:
  - `src/types/index.ts`
  - backend DTO mapping in `server/src/data.ts`
  - Prisma schema and seed data
- Keep `newChannels` and `existingChannels` structurally in sync when adding or removing funnels/channels.
- `activeProduct === null` is meaningful UI state and should continue to show the overview dashboard.
- Most frontend updates are optimistic and then reconciled with the server response; avoid changing response shapes casually.
- Local images live in `public/images/`.
  - Sidebar logo: `public/images/B.png`
  - Dashboard logo: `public/images/Chan.png`
- Styling is utility-first Tailwind directly in components; match the existing visual language unless the task is a deliberate redesign.
- SQLite writes and some dev-server commands can fail inside restricted environments; in those cases prefer the batch files or unsandboxed local runs.

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

## Files To Check Before Major Changes

- `src/context/ProductContext.tsx`
- `src/components/Dashboard.tsx`
- `src/components/MonitoringTable.tsx`
- `src/components/Sidebar.tsx`
- `src/lib/api.ts`
- `src/types/index.ts`
- `server/src/index.ts`
- `server/src/data.ts`
- `server/src/validators.ts`
- `prisma/schema.prisma`
- `prisma/seed-data.ts`
- `start.bat`

## Agent Working Agreement

- Prefer small, localized changes over broad rewrites.
- Verify with `npm run lint` after meaningful TypeScript changes.
- Run `npm run build` when changes could affect bundling or runtime behavior.
- If you change the API or data model, update Prisma schema, backend DTO mapping, and frontend context expectations together.
- If you add persistence or API calls, document the new flow in `README.md` and this file.

## Known Gaps

- No automated tests are present.
- Some local dev commands need to run outside the sandbox because Vite/esbuild and SQLite writes can be restricted here.
- Batch files are the expected Windows entrypoints for non-technical users; if startup/setup behavior changes, update them too.
- README may still lag behind product-specific UX decisions if the app changes quickly.
