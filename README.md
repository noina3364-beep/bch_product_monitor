<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

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
5. Run the frontend:
   `npm run dev`
6. Run the backend API in a second terminal:
   `npm run dev:server`

## Backend API

The backend is an Express + TypeScript + Prisma + SQLite API for BCH Product Monitor.

- Frontend URL: `http://localhost:3000`
- Backend URL: `http://localhost:3001`
- Health check: `GET /api/health`
- Main dashboard: `GET /api/dashboard`

## Useful Commands

- `npm run lint`
- `npm run build`
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:seed`
