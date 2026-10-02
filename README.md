# Tardis

An open-source day planner for recurring events and places of interest. Tardis
combines event dates, daily opening hours, a user's location, and travel times
to help answer: “What can I do today?”

The project starts as a modular monolith. TanStack Start serves the React app;
Neon/PostGIS, server functions, and domain modules are planned for the data-backed
features. A provider-neutral routing contract exists, but no routing provider is
connected yet.

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

The first migration enables PostGIS and requires a PostgreSQL role allowed to
create the extension.

## Architecture

- `src/routes`: pages; server-function BFF endpoints are planned
- `src/modules`: business capabilities; currently only identity contracts exist
- `src/services`: infrastructure-facing capabilities; currently the routing contract
  and service boundary exist, without a live provider
- `src/db`: database client setup; domain tables are not defined yet
- `drizzle`: ordered database migrations; currently only PostGIS setup
- `docs/adr`: accepted architectural decisions, including planned boundaries
- `docs/operations`: cost and operational guardrails

See [docs/architecture.md](docs/architecture.md) for module rules, request
flows, and the routing extraction path. The files in `docs/design` are proposals,
not descriptions of implemented APIs.

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
