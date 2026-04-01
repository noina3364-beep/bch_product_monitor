<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# BCH Product Monitor

This project is a product monitoring dashboard for Bangkok Hospital Chanthaburi.

- Frontend: Vite + React + TypeScript
- Backend: Express + TypeScript + Prisma
- Database: SQLite

View your app in AI Studio: https://ai.studio/apps/fd91c509-7972-4206-a2c4-f6f6f84c950a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the needed values in `.env` or `.env.local` using [.env.example](.env.example)
3. Initialize the backend database:
   `npm run prisma:push`
4. Seed the backend database:
   `npm run prisma:seed`
5. Run the frontend in one terminal:
   `npm run dev`
6. Run the backend API in a second terminal:
   `npm run dev:server`

Local URLs:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:3001`

## Backend API

The backend is an Express + TypeScript + Prisma + SQLite API for BCH Product Monitor.

- Health check: `GET /api/health`
- Main dashboard: `GET /api/dashboard`

Main route groups:

- `/api/targets/dashboard`
- `/api/products`
- `/api/products/:productId/funnels`
- `/api/products/:productId/channels`
- `/api/products/:productId/input-values`

## Frontend Notes

- The frontend is now API-backed through `src/context/ProductContext.tsx`.
- Products, funnels, channels, targets, and table inputs persist through the backend and survive refresh.
- Local logo assets live in `public/images/`.
  - Sidebar logo: `B.png`
  - Dashboard logo: `Chan.png`

## Useful Commands

- `npm run lint`
- `npm run build`
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:seed`
- `npm run build:server`

## Project Structure

- `src/`: React frontend
- `server/src/`: Express API
- `prisma/`: Prisma schema, seed data, and database bootstrap
- `public/images/`: static image assets used by the frontend
