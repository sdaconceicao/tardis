# Overture profiling assets

`taxonomy-2026-09-23.0.csv` is the Overture Places canonical taxonomy from
https://docs.overturemaps.org/taxonomy/2026-09-23.0/taxonomy.csv, downloaded on
2026-10-05. SHA-256:
`59eecbf9e24859bcdab459e8efeea673b7fcbab06b45bd1c7067f215b3bc25d4`.

The US profile uses the 2025 Census 1:500,000 state boundary archive at
https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip.
SHA-256: `9cbfe171dad1555e11770c981d8f4db9e687a65c86f5bdae684eeb487e2e9b80`.
The profiler downloads it into its temporary directory and checks this hash.
State FIPS codes 60, 66, 69, 72, and 78 are excluded, leaving the 50 states
and Washington, DC.

The local `regional-poi` profile uses [Natural Earth 50m countries](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/)
version 5.1.1 (SHA-256 `5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139`)
and 50m geographic region polygons (SHA-256
`a6e7ac257f6f0847ed80e6dc6e776441456652c093cfe90c7bf26dc8069f0d03`).
It includes North American country polygons, including Central America and the
Caribbean. Europe combines European country polygons except Russia with the
geographic Europe polygon, which keeps European Russia and Türkiye while
excluding their Asian portions. The five mapped POI groups are restaurants,
parks, museums, landmarks, and entertainment.
The regional source profile counts broad `historic_site` rows, but the importer
rejects that generic subtype because it frequently labels residences. Specific
landmark taxonomy types remain eligible.

The selected Overture data release is `2026-09-23.1`. The profiler validates
its STAC file manifest and never reads the PMTiles inspection layer. Category
rules in `category-policy.ts` resolve exact taxonomy IDs and descendants;
changing them requires a profile version bump and a new sizing report.

`manifest-2026-09-23.1.json` freezes the 16 Places Parquet assets for this
release (SHA-256 `00e55248833cc877cf0722d3fef7bff27366590d615be3feb178bfd87c514e67`).
The importer reads this checked snapshot, so a checkpointed run can resume
without another STAC request. `profile-us-2026-09-23.1-five-groups.json` is the complete scan of
restaurants, parks, museums, landmarks, and entertainment. The production
`profile-us-2026-09-23.1-poi.json` selects museums and entertainment from that
scan, with 154,464 accepted POIs across the 50 states and DC. Restaurants
alone add 1,004,406 POIs and do not fit the 150 MB places budget.

`storage-measure-2026-09-23.1-poi.json` records a rolled-back PostGIS probe
using 10,000 real Overture POIs from the selected categories. It measured
720.896 bytes per POI, projecting 111,352,480 bytes for the production
selection. The hosted importer validates these reports and the current
database size before any write, reserving another 20% for storage variation.
