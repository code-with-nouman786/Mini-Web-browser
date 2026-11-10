# Mini Web Browser

Wyxan Full Stack Technical Assessment, stage 4: secure browser interface and site navigation.

This npm workspaces monorepo contains a Next.js frontend, a NestJS backend, and a
local MongoDB service. The frontend supports person selection, typed browsing and
internal links in an isolated page viewport. Back and forward are displayed but
disabled; there is no navigation stack, search UI, history UI or publishing UI.
`GET /api` still returns initialization status.

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
| `GET /api/search?q=<query>` | Plain-word query, up to 200 characters | `200`: relevant search results; `400` for malformed queries |

`author` and `person` are existing Person IDs. There is no person-creation endpoint
or automatic data insertion at application startup. Run `npm run seed` to create
the demonstration people, or use an existing database person for write examples.

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
Site GET and POST responses return `sanitizedHtml` instead of the raw `html`
field. Stored raw HTML is retained in MongoDB but is never sent to the viewport.

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

## Deterministic seed and content search

With Docker running and the existing environment files configured, run from the
repository root:

```sh
npm run db:up
npm run seed
npm run dev:backend
```

The seed command builds the backend, connects using `apps/backend/.env`'s
`MONGODB_URI`, writes the seed, closes the connection, and exits without starting
an HTTP server. It can be rerun at any time. Fixed-ID MongoDB upserts restore the
same 4 people, 10 original pages, and 38 visits without duplicating them or deleting
unrelated records. Both authors own 5 pages. Visits span exactly
`2026-10-01T09:00:00.000Z` to `2026-10-01T10:00:00.000Z`, include repeats and missing
addresses, and give Ada a linked trail through all 10 pages. IDs, content,
publication dates, and visit times do not depend on the machine's clock.

Seeded HTML uses `<a href="https://tides.local" data-address="tides.local">` for
internal links. A future frontend can intercept `a[data-address]` and use the
canonical address. Several targets deliberately have no Site record; seeding
preserves these links and records missing visits without creating placeholder sites.

In another terminal, query words that occur in the written body, not the titles:

```sh
curl --get 'http://localhost:3001/api/search' --data-urlencode 'q=bioluminescence'
curl --get 'http://localhost:3001/api/search' --data-urlencode 'q=cyanotype'
curl --get 'http://localhost:3001/api/search' --data-urlencode 'q=harbor garden'
curl 'http://localhost:3001/api/search?q=' # []
```

Search uses one MongoDB text index over both `title` and `plainText`, with title
weight 5 and body weight 1. It matches whole words case- and accent-insensitively,
without stemming or stop-word removal. Multiple words use OR semantics. Results
sort by descending text relevance, then ascending unique address, and are limited
to 50. Each result contains `address`, `title`, a matching plain-text `excerpt`,
`author` (`_id` and `name`, or `null` if absent), and ISO `publishedAt`; it never
includes the HTML field. A title-only match uses title text for the excerpt.
The existing unique-address and per-person history indexes remain, and a compound
name/ID index supports stable people lookup ordering. Indexes are ready before
the backend accepts requests or the seeder writes records.

A missing, empty, or whitespace-only `q` returns `[]` without querying MongoDB.
Whitespace is collapsed. Queries support Unicode letters and numbers, spaces,
and apostrophes or hyphens within words. Arrays, objects, overlong values,
non-whitespace control characters, quotes, regex syntax, and search operators receive `400`.

## Browser startup and HTML containment

After the existing environment-file setup, start MongoDB, seed the collection and
run both applications from the repository root:

```sh
npm ci
npm run db:up
npm run seed
npm run dev
```

Open <http://localhost:3000>, choose a person and submit `harbor.local`. The typed
API client uses `NEXT_PUBLIC_API_URL` from `apps/frontend/.env.local`; this public
value must be set before a production frontend build. Successful and missing
typed/link navigations record a Visit for the selected person. No person means
no navigation or Visit. A failed Visit write is shown separately from a page error.

Every stored page is hostile. Backend `sanitize-html` applies a strict tag and
attribute allowlist, removes author scripts, event handlers, CSS, forms, frames,
plugins and resource URLs, and exposes only `sanitizedHtml` for rendering. Safe
prose, headings, lists, tables and code remain. Discarding all author CSS is an
intentional styling trade-off; a small trusted stylesheet supplies readable defaults.
Marked absolute links must match their `data-address`; bare internal identifiers
are also supported. Accepted links are rewritten to inert `href="#"` plus a
normalized `data-internal-address`. Unmarked external URLs and unsafe schemes are
removed. Address strings are database lookup identifiers, never fetched websites,
so broken links remain valid content and produce the in-product Nowhere state.

The frontend uses only `sanitizedHtml` in a `srcDoc` iframe. Its sandbox allows
scripts solely for one fixed link bridge and deliberately omits `allow-same-origin`,
forms, popups and top-navigation permissions. A CSP meta tag precedes content,
denies network resources/connections and forms, and pins the exact bridge and
trusted stylesheet by SHA-256; inline handlers and author styles are forbidden.
The bridge is injected after sanitization, prevents link defaults (including
modified/middle clicks), and sends only an internal address to the exact parent
origin. Opaque frames emit a `null` origin, which is not a trustworthy identity:
the parent also checks the current frame's WindowProxy, a fresh per-document
channel, exact message shape and canonical address. Only then may it browse and
record source `link`. Tests pin the hashes and exercise real Chromium containment.

## Build and verification

```sh
npm run lint
npm run typecheck
npx playwright install chromium
npm test
npm run build
```

The root build command runs production builds for both applications. Builds do
not require MongoDB to be running. Frontend output is generated in
`apps/frontend/.next`; backend output is generated in `apps/backend/dist`.
Dependencies, build output, TypeScript caches, and local environment files are
excluded from Git.

`npm test` runs both apps' tests, including typed/link navigation, sanitization,
message validation and real Chromium iframe/CSP checks, alongside the existing
domain, seed and search tests. API/database tests use doubles and do not require
MongoDB. Tests compile into ignored `.test-dist` directories. If using an existing
Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable
instead of downloading a browser. Production bundles exclude test code.

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
| `npm test` | Run backend, frontend and Chromium containment tests |
| `npm run seed` | Upsert the deterministic demonstration data |
| `npm run db:up` | Start MongoDB and wait for readiness |
| `npm run db:logs` | Follow MongoDB logs |
| `npm run db:down` | Stop MongoDB and retain the database volume |

Database data persists in the Compose-managed `mongodb_data` volume between
restarts.
