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

## Frontend shell

The Sky Atlas theme uses Lago components and tokens, with Josefin Sans headings,
Source Sans 3 body text, and light/dark palettes. The striped brand mark is a
placeholder logo. Appearance follows the system initially and remembers the
user's light/dark choice.

Navigation is implemented with TanStack Router and Lago links: Map (`/`),
Calendar (`/calendar?view=week`, `month`, or `agenda`), Saved (`/saved`),
My events (`/my-events`), About & help (`/about`), and account pages
(`/login`, `/signup`). Add event leads to signup.

These are placeholder sections: maps, event data, location/date controls,
saving, and event creation are not connected. The discovery list sits beside the main view on desktop and
below it on phones.

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

The Playwright suite starts the local app and runs the account flows in Chromium,
Firefox, and WebKit. It mocks auth responses so no Resend or OAuth credentials
are needed for browser tests.

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

The public HTTP contract is versioned at `/api/v1`. Open `/api/docs` for
interactive Swagger documentation or `/api/openapi.json` for the OpenAPI
specification. External frontend origins are configured with
`API_ALLOWED_ORIGINS`; cookie and signed Better Auth bearer sessions are
supported. See [the API guide](docs/api/domain-endpoints.md).
