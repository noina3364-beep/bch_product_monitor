# CODEX.md

This file gives Codex and other coding agents the minimum project context needed to work safely and quickly in this repository.

## Project Overview

- Project name: BCH Product Monitor
- Stack: Vite, React 19, TypeScript, Tailwind CSS v4, Lucide icons
- App shape: single-page dashboard for monitoring products, funnels, channels, visits, and revenue
- State model: client-side only, centered in `src/context/ProductContext.tsx`
- Data source today: mock data from `src/data/mockData.ts`
- Deployment origin: this repo appears to be exported from Google AI Studio

## Useful Commands

- Install dependencies: `npm install`
- Start local dev server: `npm run dev`
- Type-check: `npm run lint`
- Production build: `npm run build`
- Preview build: `npm run preview`

Notes:

- `npm run lint` runs `tsc --noEmit`; there is no ESLint setup in this repo yet.
- `npm run clean` uses `rm -rf dist`, which is POSIX-style and may not work in a plain Windows shell.

## Environment

Expected environment variables are documented in `.env.example`:

- `GEMINI_API_KEY`
- `APP_URL`

For local work, follow the README and place the needed values in `.env.local` if required.

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
- all mutations for products, funnels, channels, and cell values

When changing data behavior, update the provider first and keep components thin.

### Data model

Types live in `src/types/index.ts`.

Important shape:

- A `Product` has shared `funnels` and `channels`
- Metric data is split into two categories:
  - `newChannels`
  - `existingChannels`
- Each category is keyed as `funnelId -> channelId -> { visits, revenue }`

## Implementation Notes

- Preserve immutable updates in `ProductContext`; nested updates are easy to break.
- Keep `newChannels` and `existingChannels` structurally in sync when adding or removing funnels/channels.
- `activeProduct === null` is meaningful UI state and should continue to show the overview dashboard.
- The app currently has no persistence layer. Do not assume backend storage exists unless you add it intentionally.
- Styling is utility-first Tailwind directly in components; match the existing visual language unless the task is a deliberate redesign.

## Files To Check Before Major Changes

- `src/context/ProductContext.tsx`
- `src/components/Dashboard.tsx`
- `src/components/MonitoringTable.tsx`
- `src/components/Sidebar.tsx`
- `src/types/index.ts`
- `src/data/mockData.ts`

## Agent Working Agreement

- Prefer small, localized changes over broad rewrites.
- Verify with `npm run lint` after meaningful TypeScript changes.
- Run `npm run build` when changes could affect bundling or runtime behavior.
- If you change the data model, update types and all context mutations together.
- If you add persistence or API calls, document the new flow in `README.md` and this file.

## Known Gaps

- No automated tests are present.
- No backend or database is wired in the current code.
- README is still mostly the default AI Studio export and may lag behind the actual product behavior.
