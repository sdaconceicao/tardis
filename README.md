# Tardis

An open-source day planner for recurring events and places of interest. Tardis
combines event dates, daily opening hours, a user's location, and travel times
to help answer: “What can I do today?”

The project starts as a modular monolith: TanStack Start serves the React app
and backend-for-frontend, domain data lives in Neon/PostGIS, and routing is an
in-process service with a provider-neutral contract so it can move to a
separate deployment when demand justifies it.

## Local development

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Set `DATABASE_URL` in `.env.local` before using database-backed features. The
initial shell can run without connecting to the database.

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

- `src/routes`: pages and thin TanStack server-function BFF endpoints
- `src/modules`: business capabilities such as identity, events, and places
- `src/services`: infrastructure-facing capabilities, beginning with routing
- `src/db`: shared database client and schema composition
- `drizzle`: ordered database migrations
- `docs/adr`: accepted architectural decisions
- `docs/operations`: cost and operational guardrails

See [docs/architecture.md](docs/architecture.md) for module rules, request
flows, and the routing extraction path.

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
