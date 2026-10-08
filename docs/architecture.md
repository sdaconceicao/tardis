# Architecture

## Shape

Tardis is a modular monolith built as one TanStack Start application for Vercel.
TanStack server routes form the backend-for-frontend (BFF). Event, place,
identity, planning, and HTTP API modules are implemented. The browser has a
MapLibre POI map; the calendar remains a placeholder. Routing has a
provider-neutral contract but no live provider. The planning flow below includes
planned pieces.

```text
Browser (React + Lago + MapLibre)
                 |
        TanStack BFF endpoints
                 |
       Application/domain modules
          |                 |
  PostgreSQL/PostGIS  RoutingService
                      (provider pending)
```

The BFF endpoint layer owns HTTP concerns: authentication, input parsing,
response shaping, and status mapping. Business rules belong in modules and
must not depend on TanStack request primitives. This keeps the UI-facing API
small without tying domain code to the BFF.

## Module boundaries

The capabilities and their intended boundaries are:

- `identity`: resolves the current actor and applies authorization policy.
- `events`: owns recurring event definitions, dated occurrences, exceptions,
  and event search.
- `places`: owns locations of interest, geospatial data, opening-hour rules,
  and date-specific exceptions.
- `planning`: combines candidates from events and places with availability and
  travel estimates for a particular day. It orchestrates other modules; it
  does not own their records.
- `routing`: calculates travel matrices and directions through a
  provider-neutral service contract.

Each module should expose a narrow public entry point. Other modules call that
entry point rather than importing internal repositories or database tables.
Cross-module writes go through the owning module. Database transactions can
span modules in the monolith when correctness requires it, but the caller
should document that coupling.

## Data principles

- Store place coordinates as PostGIS `geography(Point, 4326)` and add a GiST
  index for proximity searches.
- Store recurring definitions separately from generated occurrences. Do not
  materialize an unbounded future calendar; expand into a bounded query window
  and cache/materialize only when measurements justify it.
- Store opening-hour rules and date-specific overrides separately. A closure or
  exceptional schedule for a date takes precedence over the weekly rule.
- Save the IANA time zone on events and places. Evaluate recurrence and opening
  hours in that zone, not in the server's time zone.
- Keep source attribution and source identifiers so imported community data can
  be refreshed and audited.

## Request flow for “today”

1. The BFF validates the requested date, location, filters, and travel profile.
2. Planning asks events and places for geographically bounded candidates.
3. Each owning module evaluates recurrence or opening hours in local time.
4. Planning narrows and ranks candidates before requesting a bounded routing
   matrix. Straight-line distance can prefilter the set cheaply.
5. The BFF returns display-ready results and provider-neutral availability
   states to the browser.

Routing is enrichment, not a prerequisite for discovering candidates. If the
provider is unavailable or over quota, the planner can still return candidates
with approximate distance and a clear degraded state.

## Scaling and extraction

The intended deployment uses stateless BFF invocations and a pooled PostgreSQL
connection. Spatial indexes and bounded queries should handle the initial data
volume. Better Auth sessions protect private reads and writes.

Routing has a contract, validation, and unavailable-result types. A provider
adapter, caching, quotas, and concurrency control remain future work.
No route or domain module may call OpenRouteService directly. Start with an
in-process implementation when routing is connected. Add caching, quotas, and
concurrency control at the routing service boundary when traffic demands them.

To extract routing later:

1. Implement the same contract in a separately deployed HTTP worker.
2. Replace the local provider with an HTTP client adapter.
3. Move routing-specific cache and rate-limit state with the worker.
4. Keep server functions and planning code unchanged.

The TypeScript interface is the design boundary, not a promise that an eventual
network API will use TypeScript types. Before extraction, freeze the wire format
with a versioned schema and add contract tests against both implementations.

Events may later need background ingestion or occurrence projection. That work
should start as a job entry point calling the events module, then move to a
separate worker only if runtime or throughput exceeds Vercel's practical
limits. It need not force the read/write API into a microservice.

## UI

Use `@code-x/lago` directly where a Lago component is useful and load its
published stylesheet once in the root route. Application CSS may use Lago's
tokens. Do not add a local wrapper component for every Lago primitive; add an
application component only when it carries real product behavior or repeated
composition.

MapLibre renders the POI map from bounded places-module discovery responses.
The basemap uses a configurable vector style URL; POI data comes from PostGIS,
not from the tile provider. Broad views show clusters and close views show
individual places. Map style URLs are public browser configuration, while
database credentials and routing API keys remain server-only. See
[ADR 0004](adr/0004-map-poi-discovery.md).

## Initial domain implementation

REST handlers under `src/routes/api` delegate to module entry points and use
Better Auth session identity. The identity module hosts Better Auth with a
Drizzle adapter.
Neon hosts PostgreSQL; Neon Auth is not required. Domain writes use interactive
Drizzle transactions through `pg` and the pooled database URL. The DB schema
composition imports module-owned tables; schema-level foreign keys are the
explicit exception to the runtime module-import boundary.

Events have occurrences and days, with one continuous interval per day. Place
hours remain relational. Availability combines spatial filtering, indexed
stored event-day intervals, bounded recurrence expansion, and seasonal hours.
Database constraints enforce venue visibility and schedule consistency alongside
application validation. See [the API guide](api/domain-endpoints.md).

### HTTP contracts

`src/http/operations.server.ts` registers domain operations once for both
`/api/v1` and the compatible unversioned aliases. Routes delegate to that
registry; business rules stay inside module services. Request schemas are
owned by modules, while explicit JSON response schemas live in
`src/http/responses.ts`. The registry generates OpenAPI at
`/api/openapi.json`, with locally served Swagger UI at `/api/docs`. Better
Auth keeps its own catch-all and generated authentication specification.
CORS uses an exact origin allowlist shared with Better Auth. Protected
requests accept either a cookie with an allowed Origin or a verified signed
bearer session; invalid bearer credentials never fall back to cookies.
