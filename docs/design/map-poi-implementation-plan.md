# Map and POI implementation plan

Status: In progress, 2026-10-06. The environment resolver, read-only Overture
profiler, catalog schema, resumable importer, discovery endpoints, and
MapLibre/Lago map interface are implemented. The hosted capacity gate is
implemented; full local and hosted bootstrap remain. The complete US scan
selected 30,936 museums and 123,528
entertainment venues. Restaurants exceed the current places budget.
Map bounds, category, and POI selection are shareable URL state. Browser Back
restores the prior selection. The earlier worldwide bootstrap stopped after
7.95 million POIs; local import now targets North America and Europe POIs.
It narrows the [public discovery frontend](public-discovery-frontend.md) and
[Overture ingestion](overture-places-ingestion.md) proposals to a first working
map with places of interest (POIs). Routing, travel times, directions, and
calendar work are outside this milestone.

## Outcome and current state

The `/` route shows an interactive vector map and public POIs from Tardis's
database. Broad views show server-aggregated clusters; completed imports build
a fine-cell summary for fast wide-zoom requests. Local views show bounded
individual places. Selecting a map item selects the same result in the list and
opens its details. People can browse without signing in, including when the
basemap fails.

At the planning baseline, `MapPlaceholder` and `ResultsPanel` contained no live
data. The map now reads bounded discovery endpoints; imported POIs can be
browsed independently of the known-open availability endpoint. The Overture
proposal describes the catalog and import rules in more detail.

## Decisions for this milestone

- Use MapLibre GL JS for rendering and a replaceable vector style URL. Set the
  initial public style to [OpenFreeMap Liberty](https://openfreemap.org/quick_start/)
  through `VITE_MAP_STYLE_URL`. Keep the provider attribution visible. The
  public instance currently offers free use without an API key but no SLA;
  the list must remain useful if tiles fail. Basemap labels and Tardis POIs are
  separate data sources: the latter come only from the Tardis discovery API.
- Use Overture `places/place` GeoParquet as the POI source, pinned to a release
  and manifest for each run. The importer reads source files in a separate job;
  map requests read PostGIS only. Do not use Overture inspection PMTiles as a
  production basemap or as the live POI query path.
- Use one importer with explicit environment configuration. `regional-poi`
  selects restaurants, parks, museums, landmarks, and entertainment in North
  America and Europe. A pinned Natural Earth boundary includes Central America,
  the Caribbean, European islands, and only the European parts of
  transcontinental countries. `neon-free` means the 50 US states and
  Washington, DC, limited to the
  versioned museum and entertainment allowlist. This includes Alaska and
  Hawaii. Restaurants were measured separately and do not fit the current
  budget. Source records that
  fail validation are counted and quarantined, not silently interpreted as a
  smaller requested scope.
- Run imports only through an explicit command or scheduled job. A local build,
  app startup, or `pnpm dev` must not start a planet scan. `NODE_ENV` is not an
  import selector: a production build can target a local database, and a local
  shell can target Neon.
- Keep unknown hours unknown. A source record's `operating_status=open` does
  not mean it is open at the selected time. Preserve place source and license
  attribution and keep ordinary user edits away from catalog-owned fields.

## 1. Resolve and profile the import environments

1. Add versioned `regional-poi` and `neon-free` profiles under `config/overture/`, with
   exact taxonomy IDs and descendants, explicit exclusions, a versioned US
   boundary, quality rules, batch limits, and hosted storage ceilings. Check
   mappings against the pinned release rather than category-name substrings.
2. Add importer-only settings to `.env.example` and a validated resolver in
   `src/services/overture/config.ts`:

   | Environment | `OVERTURE_SYNC_PROFILE` | `OVERTURE_DEPLOYMENT_TARGET` | Execution |
   | --- | --- | --- | --- |
   | Local PostGIS | `regional-poi` | `local` | Manual `pnpm poi:sync` |
   | Production Neon | `neon-free` | `hosted` | Explicit bootstrap, then scheduled release checks |

   These setting names are the proposed job contract. Require both values in
   hosted jobs. Reject `regional-poi` against a Neon host, reject missing hosted policy,
   and enforce hosted ceilings after any CLI override. Save the resolved config
   and selection fingerprint with each run; resuming must use that frozen config.
   An empty selection is an error, never a mass-retirement instruction.
3. Implement `pnpm poi:profile` before the write path. For a pinned Overture
   release, report accepted/rejected counts by region and category, estimated
   table/index size, extraction time, and dense-city query samples. Measure the
   complete US allowlist including restaurants. Do not substitute a first-N
   sample for the requested production scope.
4. Gate production bootstrap on measured headroom. The existing proposal's
   150 MB places and 350 MB total targets are planning budgets, not measured
   capacity or provider guarantees. If the selected US set exceeds the budget,
   stop with a report and decide explicitly whether to narrow the allowlist or
   fund more storage. Local `regional-poi` has no application-imposed row ceiling, but
   the profile command must report its real disk and memory requirements.

## 2. Build the catalog importer

1. Add migrations for catalog-managed places: owner/management constraints,
   source identity, import runs and batches, lifecycle state, and the indexes
   needed for spatial browsing. Keep existing user places and event venue
   references valid. Expose a trusted import entry point from `places`; keep
   source extraction and checkpoints in `src/jobs` and `src/services/overture`.
2. Use bounded DuckDB extraction from the pinned GeoParquet release. Apply US
   geography and taxonomy filtering before loading Neon. Resolve a timezone
   with a versioned offline lookup and quarantine unresolved points. Store
   Overture GERS IDs separately from stable Tardis UUIDs. Preserve source
   metadata and attribution, while leaving authored hours, prices, and tags
   untouched.
3. Stage and reconcile bounded batches idempotently. Commit the place changes
   and batch checkpoint together; replay must not duplicate places. Changed
   locations create new location rows so saved event venues do not move.
   Retire only after a complete scoped snapshot or valid delta chain; never
   infer removal from a failed or partial extraction. Support targeted rollback
   of source-managed fields and preserve user enrichment.
4. Run one repeatable sample import and replay in the test database before a
   full local bootstrap. Then bootstrap `regional-poi` locally and the measured US
   selection in production. Keep raw/rejected/rollback artifacts outside Neon.
   Schedule a weekly production release check after bootstrap; import a new
   monthly release only when the release or selection/mapping version changes.

## 3. Add bounded POI discovery

1. Add a places-module spatial read entry point and a thin public
   `/api/v1/discovery` route for bounds or center/radius, category filters,
   stable cursor pagination, and a bounded result size. Return only public,
   active, eligible places with ID, name, coordinates, category, address,
   operational status, hours state, source attribution, and catalog freshness.
   Batch enrichment rather than querying each card separately. A POI can be
   browsed with unknown hours; `/api/v1/availability` retains its strict
   known-open meaning.
2. Add `/api/v1/discovery/clusters` with the same eligibility rules, bounds,
   zoom, and filter semantics. A completed import builds category-level fine
   cells for zooms 0–5; viewport edge cells produce approximate counts, labeled
   as such in the API and UI. Zooms 6–7 aggregate bounded live records. Return
   counts and expansion bounds, never the full catalog to the browser. Measure
   regional broad views and dense cities after the completed bootstrap.
3. Apply indexed spatial and eligibility filters before pagination. Fix the
   current `nearbyLocations`/500-place availability path separately as part of
   catalog readiness, so dense imported POIs do not make known-open searches
   fail. Keep counts, list results, and clusters consistent; distinguish no
   matches, incomplete/capped searches, and areas without imported coverage.
   Document the new additive endpoints in OpenAPI.

## 4. Replace the map and result placeholders

1. Replace `MapPlaceholder` with a client-mounted MapLibre component in the
   home route. Load its CSS, configure the Vite worker as required, initialize
   from `VITE_MAP_STYLE_URL`, and release the map on unmount. Keep the map shell
   and list visible through style or network errors. Start with a US view as in
   the discovery proposal; let local `regional-poi` users pan through North
   America and Europe.
2. Connect viewport/filter requests to the new discovery endpoints. Broad
   zooms render clusters; close zooms render bounded POIs. Use MapLibre sources
   and layers for bulk points rather than thousands of DOM markers. Cluster
   activation zooms to its expansion bounds. Abort stale requests. Panning
   exposes **Search this area** and keeps the old result set until committed.
3. Replace `ResultsPanel` placeholders with matching POI cards, counts, loading,
   empty, retry, and pagination states. Clicking a point selects its card;
   selecting a card highlights its point and opens a detail view. Give
   coincident POIs a group/list interaction. Preserve viewport, filters, and
   selection in shareable URL state and restore the list on browser Back.
4. Retain the existing responsive sidebar/phone results layout. Make all
   essential actions available by keyboard and touch, announce result changes,
   and preserve a complete list alternative when WebGL or tiles fail. Do not
   add a routing request, travel-time label, or in-app directions control.

## Verification and release gates

- **Configuration:** local explicit sync resolves to North America and Europe
  across the five POI groups;
  hosted sync resolves to US allowlist; missing hosted settings, unknown keys,
  empty scope, and `regional-poi` against Neon fail before writes. Overrides cannot
  bypass hosted budgets. Profile changes trigger reconciliation even if the
  Overture release is unchanged.
- **Import:** test replay, interruption/resume, changed coordinates, closure,
  category entry/exit, missing timezone/address, incomplete manifests, and
  rollback. Verify gas stations/offices are absent from hosted selection,
  intended POIs in Alaska/Hawaii are present, and unrelated categories stay
  out of the local selection. Unknown hours never become an “Open now” claim.
- **API:** integration tests cover visibility, stable cursors, bounding boxes,
  dense areas, cluster/list count agreement, category filters, source fields,
  and truthful capped/coverage responses. Measure query time and database size
  against the profiled production budget before exposing the full catalog.
- **UI:** Playwright checks map/list/detail/Back on phone and desktop, keyboard
  selection, coincident points, stale-request cancellation, tile failure, empty
  results, and URL restoration. Verify map attribution and no routing calls.

The milestone is complete when a fresh local database can be explicitly loaded
with the complete valid regional Overture POI scope, the production job can load the
measured US allowlist within its approved capacity, and `/` can browse those
POIs through a usable vector map and synchronized list.
