# Architecture

## Shape

Tardis is designed as one TanStack Start application for Vercel. The current
checkout has a frontend shell, database client setup, a PostGIS migration,
identity contracts, and a provider-neutral routing service boundary. Domain
tables, event/place/planning modules, server functions, and a live routing
provider have not been implemented. The diagram and flows below describe the
target architecture.

```text
Browser (React + Lago styles; MapLibre planned)
                 |
        TanStack server functions
                 |
       Application/domain modules
          |                 |
    Neon/PostGIS      RoutingService
                           |
                 OpenRouteService adapter
```

The server-function layer owns HTTP concerns: authentication, input parsing,
response shaping, and status mapping. Business rules belong in modules and
must not depend on TanStack request primitives. This keeps the UI-facing API
small without tying domain code to the BFF.

## Module boundaries

The planned capabilities are:

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

The intended deployment uses stateless BFF invocations and Neon's serverless
database connection. Spatial indexes and bounded queries should handle the
initial data volume. Authentication will be checked at the edge of protected
requests when those requests exist.

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

MapLibre is the planned interactive map renderer; the current map is a
placeholder. Map style URLs are public browser configuration, while database
credentials and routing API keys remain server-only.
