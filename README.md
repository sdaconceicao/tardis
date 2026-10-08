# Tardis

An open-source day planner for recurring events and places of interest. Tardis
combines event dates, daily opening hours, a user's location, and travel times
to help answer: “What can I do today?”

The project is a modular monolith. TanStack Start serves the React app and HTTP
API; domain modules store events and places in PostgreSQL/PostGIS. A
provider-neutral routing contract exists, but no routing provider is connected
yet.

## Local development

```bash
pnpm install
docker compose up -d --wait
cp .env.example .env.local
pnpm db:migrate
pnpm start:dev
```

The Compose service runs PostgreSQL/PostGIS on localhost port 5435. It holds
separate `tardis` and `tardis_test` databases. The example environment points
to both; use a pooled Neon `DATABASE_URL` for deployed environments. Set a
unique `BETTER_AUTH_SECRET` in `.env.local` before using account features. The
dev app runs at `http://localhost:3006`, matching the example auth URL.

### Preparing Overture POI imports

Install the DuckDB CLI on macOS and its cloud-file and geometry extensions:

```bash
brew install duckdb
duckdb -c "INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;"
```

Overture requires DuckDB 1.1.0 or newer for GeoParquet. The machine running an
import needs outbound access to DuckDB's extension downloads and the public S3
`places/place` files; profiling also reads Overture's STAC catalog. Overture's public S3 examples
do not require an Overture API key. The importer pins release `2026-09-23.1`
and validates its [STAC manifest](https://docs.overturemaps.org/getting-data/cloud-sources/);
see the [DuckDB query examples](https://docs.overturemaps.org/getting-data/duckdb/).

For the local PostGIS database, uncomment these lines in `.env.local` and check
the resolved scope:

```dotenv
OVERTURE_SYNC_PROFILE=regional-poi
OVERTURE_DEPLOYMENT_TARGET=local
```

```bash
pnpm poi:check-config
```

The check prints the profile and selection fingerprint without printing
`DATABASE_URL`. It does not download or import POIs. Profile the pinned release
before loading a database:

```bash
pnpm poi:profile --scope neon-free --output /tmp/tardis-us-poi-profile.json
# Optional one-file SQL check; its counts are incomplete and cannot size production.
pnpm poi:profile --scope neon-free --smoke
# Full local POI scope: North America and Europe across five POI groups.
pnpm poi:profile --scope regional-poi --output /tmp/tardis-regional-poi-profile.json
```

`poi:profile` reads Overture GeoParquet with DuckDB and never writes to
PostgreSQL. It checks the complete STAC file manifest, the pinned taxonomy
checksum, and, for the US profile, the 50-state-and-DC Census boundary
checksum. It reports counts by region and category, rejects records without
an ID or name, and shows illustrative storage scenarios. The complete US scan
selected 154,464 museum and entertainment POIs across 50 states and DC.
Restaurants add 1,004,406 POIs and exceed the 150 MB places budget. The scan
and selection are recorded in `config/overture/profile-us-2026-09-23.1-*.json`.
`--manifest-only` checks source metadata without scanning Parquet.
The regional importer requires the complete pinned regional profile report
before a new run can start; a one-file `--smoke` report cannot size the scope.

Imports run only from an explicit job, never from app startup or a build.
`pnpm poi:sync` extracts the selected files with DuckDB, normalizes POIs with
an offline timezone lookup, and checkpoints batches in PostGIS. It stores
compressed extraction and rejection artifacts under `.data/overture` by
default. The local `regional-poi` profile selects restaurants, parks, museums,
landmarks, and entertainment in North America and Europe. Its Natural Earth
boundaries are checksum pinned. Generic Overture `historic_site` entries are
excluded from landmarks because they often describe ordinary residences and
businesses; specific types such as monuments, castles, forts, and lighthouses
remain. After upgrading an existing local catalog, run
`pnpm poi:curate-landmarks` to retire those entries and rebuild map clusters.
An interrupted run resumes by release
and selection fingerprint. Measure actual POI storage against the disposable
test database with `pnpm poi:measure-storage --input <extracted-file>`.
Production bootstrap checks a matching capacity report and database headroom
before writing. The real 10,000-row probe projected about 111 MB of places;
the gate reserves 20% above that estimate. See the
[implementation plan](docs/design/map-poi-implementation-plan.md).

## Frontend shell

The Sky Atlas theme uses Lago components and tokens, with Josefin Sans headings,
Source Sans 3 body text, and light/dark palettes. The striped brand mark is a
placeholder logo. Appearance follows the system initially and remembers the
user's light/dark choice.

Navigation is implemented with TanStack Router and Lago links: Map (`/`),
Calendar (`/calendar?view=week`, `month`, or `agenda`), Saved (`/saved`),
My events (`/my-events`), About & help (`/about`), and account pages
(`/login`, `/signup`). Add event leads to signup.

The Map page mounts a MapLibre vector basemap using `VITE_MAP_STYLE_URL`
(OpenFreeMap Liberty by default). It reads public POIs from the discovery API,
shows clusters at broad zooms, and synchronizes nearby points with a Lago
results panel. Completed imports build a summary for fast wide-zoom clusters;
those counts are labeled approximate near viewport edges. The list sits beside
the map on desktop and below it on phones. Clicking a cluster zooms into it;
zooming automatically refreshes clusters or individual POIs for the new area.
Event data, saving, and routing are outside this map milestone.

Lago reference: [Storybook](https://main--6a4eb38660443c1eee94713d.chromatic.com/).

## Validation

Useful checks:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The Playwright suite starts the local app and runs browser flows in Chromium,
Firefox, and WebKit. Browser tests mock auth responses. The API project also
checks real HTTP routes against a disposable PostGIS database when
`TEST_DATABASE_URL`, `TEST_API_URL`, and `BETTER_AUTH_SECRET` are set. CI provides
these values and runs both the database integration and API suites without
Resend or OAuth credentials. Playwright specs live in `test/e2e`; the database
integration suite lives in `test/integration`.

Database migrations use Drizzle:

```bash
pnpm db:migrate
```

Migrations enable PostGIS and `btree_gist`, then create the domain and Better Auth
tables. The migration role must be allowed to create these extensions. Drizzle
loads `.env.local` and `.env`; application startup never migrates implicitly.

Run the integration suite against the separate test database:

```bash
pnpm test:db
```

`test:db` reads `TEST_DATABASE_URL` from `.env.local` when it is not already
set in the shell. Its database name must end in `_test`. `docker compose down`
stops Postgres and keeps both databases; `docker compose down -v` removes the
local database volume and all its data.

Set `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and
`RESEND_FROM_EMAIL` to enable email/password auth. Signups send a verification
link through Resend; users must verify before signing in. The signup page can
resend the link. The login page links to a password reset request form, and
one-time reset links are sent through Resend. Use a sender address on a domain
verified in Resend.

For social login, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, or
`FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`. Register these exact callback
URLs with the providers: `<BETTER_AUTH_URL>/api/auth/callback/google` and
`<BETTER_AUTH_URL>/api/auth/callback/facebook`. Each provider is enabled when
both values are present.

The domain API uses session cookies for writes and private reads. See
[the endpoint guide](docs/api/domain-endpoints.md) for requests, recurrence,
availability searches, and local integration tests.

## Architecture

- `src/routes`: pages and thin TanStack HTTP BFF endpoints
- `src/modules`: business capabilities such as identity, events, and places
- `src/services`: infrastructure-facing capabilities; routing has no live provider
- `src/db`: shared database client and schema composition
- `drizzle`: ordered database migrations
- `docs/adr`: accepted architectural decisions
- `docs/operations`: cost and operational guardrails

See [docs/architecture.md](docs/architecture.md) for module rules, request
flows, and the routing extraction path. The files in `docs/design` record design
choices; [the API guide](docs/api/domain-endpoints.md) describes the implemented
HTTP contract.

## Deploy to Vercel

1. Push this repo to GitHub, GitLab, or Bitbucket
2. In Vercel, choose **Add New > Project** and import the repo
3. Keep the detected TanStack Start framework settings
4. Add production values from `.env.example` under **Settings > Environment Variables**
5. Deploy

Vercel runs the build script and deploys Nitro's output as Vercel Functions and
static assets. The included `vercel.json` makes framework detection explicit.

Variables prefixed with `VITE_` are included in the browser bundle. Keep secrets
unprefixed so they remain server-only.

Production POI imports need a separate batch runner with DuckDB and its
extensions, scratch disk, artifact storage, and a server-only Neon database
credential. Set `OVERTURE_SYNC_PROFILE=neon-free` and
`OVERTURE_DEPLOYMENT_TARGET=hosted` in that runner, then run
`pnpm poi:check-config`. Run `pnpm poi:sync` from the batch runner; it checks
the release-matched capacity report and current database headroom before any
write. The pinned release, taxonomy, and 50-state-and-DC boundary are described in
[config/overture/README.md](config/overture/README.md). A Vercel app deployment
does not populate POIs.

The public HTTP contract is versioned at `/api/v1`. Open `/api/docs` for
interactive Swagger documentation or `/api/openapi.json` for the OpenAPI
specification. External frontend origins are configured with
`API_ALLOWED_ORIGINS`; cookie and signed Better Auth bearer sessions are
supported. See [the API guide](docs/api/domain-endpoints.md).
