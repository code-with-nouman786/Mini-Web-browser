# Mini Web Browser

Wyxan Full Stack Technical Assessment, stage 2: backend domain and browsing APIs.

This npm workspaces monorepo contains a Next.js frontend, a NestJS backend, and a
local MongoDB service. The frontend remains an initialization placeholder. The
backend stores people, sites, and visits and exposes the APIs documented below.
There is no frontend browser UI, navigation stack, search, seed data, publishing
workflow, or HTML iframe rendering. `GET /api` still returns initialization status.

## Architecture

| Path | Purpose |
| --- | --- |
| `apps/frontend` | Next.js App Router, React, and TypeScript |
| `apps/frontend/src/app` | Root layout, placeholder page, and global styles |
| `apps/backend` | NestJS and TypeScript |
| `apps/backend/src` | Bootstrap, validation, and people/sites/visits modules |
| `apps/backend/test` | Focused unit tests using Node.js's built-in test runner |
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

## Backend API

All routes use the `/api` prefix. Request bodies must be JSON. DTO validation
rejects invalid MongoDB IDs, invalid enum values, missing required fields, and
unknown properties with HTTP `400`.

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /api/people` | None | `200`: existing people, sorted by name and ID |
| `GET /api/sites/:address` | URL-encoded address parameter | `200`: site; `404` when it does not exist |
| `POST /api/sites` | `address`, `title`, `html`, `plainText`, `author`; optional ISO 8601 `publishedAt` | `201`: stored site; `409` for a duplicate address; `404` for an unknown author |
| `POST /api/visits` | `person`, `address`, `source` | `201`: recorded visit; `404` for an unknown person |
| `GET /api/people/:personId/history` | MongoDB person ID | `200`: that person's visits, newest first; `404` for an unknown person |

`author` and `person` are existing Person IDs. There is no person-creation endpoint
or automatic data insertion in this stage: a fresh database returns `[]` from
`GET /api/people`. Use an existing database person for the write examples below.

Addresses are case-insensitive identifiers for locally stored sites. Normalization
trims surrounding whitespace, removes a leading `http://` or `https://`, removes
trailing slashes, and lowercases the entire address, including any path. For
example, ` HTTPS://Example.Local/Guide/// ` becomes `example.local/guide`.
Addresses must be nonempty strings of at most 2048 characters, without internal
whitespace or an unsupported URL scheme. URL-encode the entire address when
passing it as a route parameter, especially if it contains `/`, `?`, or `#`.
DTOs, service lookups, and Mongoose setters share the same normalization function.
The backend waits for the unique Site address index before accepting requests;
database duplicate-key errors are returned as HTTP `409`.

Site HTML and plain text are supplied explicitly and stored without rendering or
extracting content. `plainText` may be an empty string. `publishedAt` defaults to
the server's current time when omitted. Person names are required strings.

Visit `source` is one of `typed`, `link`, `search`, or `history`; these are metadata
values and do not implement navigation or search. The server derives `status`
(`shown` or `not_found`), the optional `site` reference, and `visitedAt`. Clients
cannot supply those fields. A missing address still produces a `201` visit with
`status: "not_found"` and no `site`; retrieving that address through `GET /sites`
returns `404`. Fetching a site does not automatically create a visit. History
includes both outcomes, filters by person, and sorts by `visitedAt` descending,
then ID descending for stable ordering. An existing person with no visits gets `[]`.

With MongoDB and the backend running, execute these commands in a POSIX shell:

```sh
API_URL=http://localhost:3001/api
curl "$API_URL/people"

# Replace this with an existing _id returned by GET /api/people.
PERSON_ID=replace-with-an-existing-person-id

curl -i -X POST "$API_URL/sites" \
  -H 'Content-Type: application/json' --data-binary @- <<JSON
{
  "address": "https://Example.Local/",
  "title": "Example",
  "html": "<h1>Example</h1>",
  "plainText": "Example",
  "author": "$PERSON_ID"
}
JSON

curl -i "$API_URL/sites/example.local"
curl -i "$API_URL/sites/missing.local" # 404

curl -i -X POST "$API_URL/visits" \
  -H 'Content-Type: application/json' --data-binary @- <<JSON
{"person":"$PERSON_ID","address":"EXAMPLE.LOCAL/","source":"typed"}
JSON

curl -i -X POST "$API_URL/visits" \
  -H 'Content-Type: application/json' --data-binary @- <<JSON
{"person":"$PERSON_ID","address":"missing.local","source":"link"}
JSON

curl "$API_URL/people/$PERSON_ID/history"
```

## Build and verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The root build command runs production builds for both applications. Builds do
not require MongoDB to be running. Frontend output is generated in
`apps/frontend/.next`; backend output is generated in `apps/backend/dist`.
Dependencies, build output, TypeScript caches, and local environment files are
excluded from Git.

`npm test` compiles and runs the backend unit tests in the ignored `.test-dist`
directory. The tests cover address normalization, unique-index setup and duplicate
error handling, missing sites, DTO validation, visit outcomes, and per-person
history. They use model doubles and in-memory Mongoose documents and do not
require a running MongoDB server. Production builds exclude the test files.

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
| `npm test` | Run the backend unit tests |
| `npm run db:up` | Start MongoDB and wait for readiness |
| `npm run db:logs` | Follow MongoDB logs |
| `npm run db:down` | Stop MongoDB and retain the database volume |

Database data persists in the Compose-managed `mongodb_data` volume between
restarts.
