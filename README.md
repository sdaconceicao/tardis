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
cp .env.example .env.local
pnpm install
pnpm start:dev
```

Set `DATABASE_URL` in `.env.local` before using database-backed features. The
initial shell can run without connecting to the database.

## Frontend shell

The Sky Atlas theme uses Lago components and tokens, with Josefin Sans headings,
Source Sans 3 body text, and light/dark palettes. The striped brand mark is a
placeholder logo. Appearance follows the system initially and remembers the
user's light/dark choice.

Navigation is implemented with TanStack Router and Lago links: Map (`/`),
Calendar (`/calendar?view=week`, `month`, or `agenda`), Saved (`/saved`),
My events (`/my-events`), About & help (`/about`), and account placeholders
(`/login`, `/signup`). Add event leads to the signup placeholder.

These are placeholder sections: maps, event data, location/date controls,
authentication, saving, and event creation are not connected. No credentials
are collected. The discovery list sits beside the main view on desktop and
below it on phones.

Lago reference: [Storybook](https://main--6a4eb38660443c1eee94713d.chromatic.com/).

## Validation

Useful checks:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

Database migrations use Drizzle:

```bash
pnpm db:migrate
```

Migrations enable PostGIS and `btree_gist`, then create the domain and Better Auth
tables. The migration role must be allowed to create these extensions. Drizzle
loads `.env.local` and `.env`; application startup never migrates implicitly.

Set `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` to enable email/password auth.
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
