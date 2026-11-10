# Mini Web Browser

Wyxan Full Stack Technical Assessment, stage 1: project architecture.

This npm workspaces monorepo contains a Next.js frontend, a NestJS backend, and a
local MongoDB service. The frontend displays an initialization placeholder; the
backend exposes only `GET /api`, which returns its initialization status. No sites,
browsing, history, search, or publishing features are implemented.

## Architecture

| Path | Purpose |
| --- | --- |
| `apps/frontend` | Next.js App Router, React, and TypeScript |
| `apps/frontend/src/app` | Root layout, placeholder page, and global styles |
| `apps/backend` | NestJS and TypeScript |
| `apps/backend/src` | Application bootstrap, root module, and status controller |
| `compose.yaml` | Local MongoDB 8.0 with a health check and persistent volume |
| `tsconfig.base.json` | Shared strict TypeScript settings |
| `package.json` / `package-lock.json` | Root workspace scripts and a single dependency lockfile |

## Prerequisites

- Node.js 24 LTS (`.nvmrc` is provided) and npm 11 or newer.
- Docker with the Docker Compose v2 plugin, including support for `up --wait`.
- Free local ports: `3000` (frontend), `3001` (backend), and `27017` (MongoDB).

## Installation

Run these commands from a terminal:

```sh
git clone https://github.com/code-with-nouman786/Mini-Web-browser.git
cd Mini-Web-browser

# If using nvm:
nvm install
nvm use

npm ci

cp .env.example .env
cp apps/frontend/.env.example apps/frontend/.env.local
cp apps/backend/.env.example apps/backend/.env
```

On Windows without a POSIX shell, copy the three example files to the same
destinations using your file manager or PowerShell `Copy-Item`.

Install dependencies from the repository root. Both applications share the root
lockfile; separate dependency installs inside the app folders are unnecessary.

## Local development

Start Docker, then run from the repository root:

```sh
npm run db:up
npm run dev
```

`db:up` waits for MongoDB to pass its health check. `dev` runs both applications
with watch mode and stops both when interrupted.

- Frontend: <http://localhost:3000>
- Backend status: <http://localhost:3001/api>
- MongoDB: `mongodb://127.0.0.1:27017/wyxan`

To run the applications in separate terminals, use `npm run dev:frontend` and
`npm run dev:backend`. MongoDB must be running before the backend starts because
NestJS establishes its database connection during startup.

## Environment configuration

| File | Variable | Default example | Purpose |
| --- | --- | --- | --- |
| `.env` | `MONGO_PORT` | `27017` | MongoDB port exposed on the host |
| `apps/frontend/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | Reserved public API base URL for later integration |
| `apps/backend/.env` | `PORT` | `3001` | Backend HTTP port |
| `apps/backend/.env` | `FRONTEND_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `apps/backend/.env` | `MONGODB_URI` | `mongodb://127.0.0.1:27017/wyxan` | Required MongoDB connection string |

The root `.env` is read by Docker Compose. Next.js reads its app's `.env.local`;
NestJS reads its app's `.env` when launched through the workspace scripts. Real
environment files are ignored by Git; the three `.env.example` files are tracked.
`NEXT_PUBLIC_` values are public and must never contain secrets.

If `MONGO_PORT` changes, also update the port in the backend's `MONGODB_URI`. If the
backend port changes, update `NEXT_PUBLIC_API_URL` to match. The local MongoDB
container has no authentication and is bound to `127.0.0.1` for development only.

## Build and verification

```sh
npm run lint
npm run typecheck
npm run build
```

The root build command runs production builds for both applications. Builds do
not require MongoDB to be running. Frontend output is generated in
`apps/frontend/.next`; backend output is generated in `apps/backend/dist`.
Dependencies, build output, TypeScript caches, and local environment files are
excluded from Git.

After building, run both applications in production mode locally:

```sh
npm run db:up
npm start
```

## Root commands

| Command | Action |
| --- | --- |
| `npm run dev` | Run frontend and backend in watch mode |
| `npm run dev:frontend` / `npm run dev:backend` | Run one application in watch mode |
| `npm run build` | Build both applications |
| `npm run build:frontend` / `npm run build:backend` | Build one application |
| `npm start` | Run both previously built applications |
| `npm run start:frontend` / `npm run start:backend` | Run one previously built application |
| `npm run lint` | Lint both applications with ESLint |
| `npm run typecheck` | Check both applications with TypeScript |
| `npm run db:up` | Start MongoDB and wait for readiness |
| `npm run db:logs` | Follow MongoDB logs |
| `npm run db:down` | Stop MongoDB and retain the database volume |

Database data persists in the Compose-managed `mongodb_data` volume between
restarts.
