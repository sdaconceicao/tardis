# ADR 0004: Serve map discovery from a bounded POI catalog

- Status: Accepted
- Date: 2026-10-08

## Context

The first map needs public places of interest (POIs) without routing. Overture
provides place data, but scanning its source files during requests or Vercel
deployments would make map availability depend on a large import. The complete
worldwide selection is too large for the local browsing goal, and the broader US
selection exceeds the production places budget. Preview deployments also need
usable data without a separate import on every deployment.

## Decision

### Map and discovery

- Render a replaceable vector basemap with MapLibre and the configured
  `VITE_MAP_STYLE_URL`; use OpenFreeMap Liberty by default. Keep basemap tiles and
  Tardis POIs separate. The results list remains usable if tiles fail.
- Let the places module serve bounded public POIs through
  `/api/v1/discovery` and `/api/v1/discovery/clusters`. Apply visibility, source
  state, operating status, category, and geographic filters in PostGIS before
  pagination. Unknown opening hours remain unknown.
- Return clusters for broad map views and individual places at close zooms.
  Completed imports build summary cells for zooms 0–5; zooms 6–7 aggregate live
  records. Mark approximate wide-view counts and cap responses. Zooming into a
  cluster refreshes the view until individual places are shown.
- Keep viewport, category, and selected POI in URL state. Cancel stale requests
  and show a Lago loading toast during map updates. Use Lago components for
  controls and results. Keep complex map and account-page effects in focused
  React hooks, with stable callbacks for handlers passed to child components.

### Catalog import

- Pin the Overture release, asset manifest, taxonomy, and geographic boundaries.
  Use DuckDB to extract source GeoParquet in an explicit `poi:sync` job, then
  normalize and checkpoint bounded batches into PostgreSQL/PostGIS. HTTP requests
  read only the database. The import record is keyed by release and selection
  fingerprint; a completed selection makes a repeat sync a quick no-op.
- Use `regional-poi` with `OVERTURE_DEPLOYMENT_TARGET=local` for the local
  PostGIS database. It covers North America and Europe, including the European
  portions of Russia and Türkiye, across restaurants, parks, museums,
  landmarks, and entertainment.
- Use `neon-free` with `OVERTURE_DEPLOYMENT_TARGET=hosted` for production Neon.
  It covers the 50 US states and DC and selects museums and entertainment only.
  The pinned scan selected 154,464 POIs, with an estimated 111 MB of places plus
  a 20% reserve. Restaurants alone add over one million records and exceed the
  150 MB places budget. A release-matched capacity report and database headroom
  check gate hosted imports.
- Exclude generic `historic_site` landmarks, which often represent residences
  or businesses. Keep specific landmark types such as monuments, castles,
  forts, and lighthouses.
- Keep `poi:profile` and `poi:measure-storage` for release and capacity changes.
  Import validation runs in `poi:sync`; separate configuration-check and legacy
  landmark-curation commands are unnecessary.

### Deployment

- Run Drizzle migrations during the Vercel build, before compiling the app.
  Run POI sync in GitHub Actions with DuckDB and the Neon project credentials.
  A branch push bootstraps the current Preview catalog; after merge, scheduled
  quarterly runs target the persistent production Neon branch and apply pending
  migrations first. A new selection can take substantial time, so the import
  must not run on every build or request. The schedule alone does not advance
  the pinned Overture release.
- Use the persistent Neon branch for Production. Preview branches should fork
  from its populated data, then receive their own migrations. Production POIs
  still require an explicit first import; migrations create schema only.
- Let Better Auth derive the public origin from Vercel's Production or Preview
  environment variables. Keep `BETTER_AUTH_URL` as an optional override for
  local or custom hosts, so preview URLs do not need individual configuration.

## Consequences

- Map reads remain bounded and independent of Overture availability. Dense
  wide views use cluster summaries, while close views can browse exact POIs.
- A new release or changed selection requires profiling, capacity validation,
  and an explicit import. Preview data reflects its parent branch at creation.
- The production catalog is limited to US museums and entertainment under the
  current storage budget. Expanding it requires new measurements and a revised
  profile.
- Routing, travel times, and directions remain outside this decision.
