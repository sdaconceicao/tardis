# Domain API

Implemented with TanStack Start server routes, Drizzle, PostgreSQL/PostGIS, and
Better Auth. The auth integration follows `pa-libertybells-250`: a Drizzle
adapter, local user/session/account/verification tables, a catch-all auth route,
and session checks at protected operations. The reference project was read only.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to your PostgreSQL/Neon pooled connection string.
3. Set `BETTER_AUTH_SECRET` to a securely generated secret of at least 32
   characters. Set `BETTER_AUTH_URL` only for a local or custom-host override;
   Vercel provides the production domain and preview branch alias automatically.
4. Run `pnpm db:migrate`, then `pnpm dev`.

The migration role needs permission to create PostGIS and `btree_gist`.
Drizzle uses `pg` for interactive transactions. Each process has a pool capped
at five connections; use Neon's pooled URL in deployments. Neither migrations
nor schema generation run automatically on application startup.

Better Auth provides email/password sign-up, sign-in, session lookup and
sign-out under `/api/auth/*`. Use the exported `authClient` from
`src/modules/identity/auth-client.ts`. OAuth credentials, mail delivery,
password-recovery email, and login UI are not part of this schema/API buildout.
Neon Auth configuration is replaced by Better Auth configuration. Neon remains
supported as the database host.

Public reads are anonymous. Authenticated reads include the user's own private
records. Private currently means owner-only. Every mutation requires a valid
Better Auth session: either a cookie plus an allowed `Origin`, or a signed
bearer token. `Authorization` takes precedence over cookies; an invalid token
returns 401 even when a valid cookie is also supplied.
Send `Content-Type: application/json` for bodies. Domain responses use
`Cache-Control: private, no-store`. Request bodies are limited to 1 MB.
Ownership comes from the session and is never accepted in request JSON.

## External frontends and API documentation

Use `/api/v1` for new clients. The unversioned domain paths remain compatible
aliases with their original response shapes. V1 returns explicit, validated
JSON DTOs: timestamps are ISO strings, prices are decimal strings, and internal
owner IDs, geography values, and child foreign keys are omitted. Breaking
contract changes will require a new major API version.

- Interactive Swagger UI: `/api/docs`.
- Downloadable OpenAPI 3.1 document: `/api/openapi.json`.
- Better Auth Swagger UI: `/api/docs?auth=1`.
- Better Auth's generated spec: `/api/auth/open-api/generate-schema`.

The domain operation registry drives routing and OpenAPI together, using the
same Zod request schemas and explicit response schemas. Runtime refinements
(such as nonoverlapping hours and visibility checks) still apply even where
JSON Schema cannot express them. Swagger assets are served locally, copied
from the locked dependency during `pnpm dev` and `pnpm build`. No external
validator receives requests or tokens. Swagger's Try it out performs real
operations; its bearer authorization is not persisted across reloads.

Set `API_ALLOWED_ORIGINS=https://frontend.example,https://admin.example` to
allow browser clients. Only exact HTTP(S) origins are accepted; no wildcard,
path, credentials, query, or fragment. The resolved auth origin and Vercel
deployment origin are always included. The same allowlist is passed to Better
Auth. OPTIONS
preflight does not require authentication. Responses to allowed origins
include credential support and expose `set-auth-token`; other origins are
rejected. CORS does not grant access to private data.

For cookie clients, use `credentials: "include"`; cookie-authenticated writes
also require an allowed Origin. Browser SameSite/third-party-cookie rules
still apply. Use bearer authentication for clients on unrelated sites or
native/CLI clients. This is a revocable Better Auth session token, **not a
JWT**. Never use the unsigned `token` in the JSON sign-in body as a bearer.

```js
const api = "https://api.example";
const login = await fetch(`${api}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error("Sign-in failed");
const token = login.headers.get("set-auth-token");
if (!token) throw new Error("Signed session token was not returned");
const result = await fetch(`${api}/api/v1/events`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

Keep browser bearer tokens in memory; native clients should use secure OS
storage. Send the same bearer header to `POST /api/auth/sign-out` to revoke
the session. Bearer-only clients can omit Origin; a supplied Origin must
still be allowed. Auth endpoints retain Better Auth's own CSRF checks.

## Routes

| Method | Path | Behavior |
| --- | --- | --- |
| GET, POST | `/api/auth/*` | Better Auth handler |
| GET, POST | `/api/v1/events` | List visible event identities; create an event |
| GET, PUT, DELETE | `/api/v1/events/:eventId` | Read, replace metadata/tags/default prices, or delete an owned event |
| GET, POST | `/api/v1/events/:eventId/occurrences` | List stored editions; create an exact edition, placeholder, or recurrence override |
| GET, PUT | `/api/v1/events/:eventId/occurrences/:occurrenceId` | Read or replace an edition and its days/prices; preserve its ID |
| DELETE | `/api/v1/events/:eventId/occurrences/:occurrenceId` | Cancel an edition; retain the override so recurrence does not recreate it |
| POST | `/api/v1/events/:eventId/recurrences` | Add a recurrence segment |
| PATCH | `/api/v1/events/:eventId/recurrences/:recurrenceId` | Shorten a segment with `{ "untilDate": "YYYY-MM-DD" }` |
| GET, POST | `/api/v1/places` | List visible places; create a place |
| GET | `/api/v1/discovery` | Browse public catalog POIs inside map bounds, with category filter and cursor |
| GET | `/api/v1/discovery/clusters` | Return bounded POI clusters for a map zoom and bounds |
| GET, PUT, DELETE | `/api/v1/places/:placeId` | Read, replace metadata/tags/prices, or delete an owned place |
| PUT | `/api/v1/places/:placeId/hours` | Replace all seasonal weekly schedules |
| PUT | `/api/v1/places/:placeId/exceptions` | Upsert one dated opening-hours exception |
| DELETE | `/api/v1/places/:placeId/exceptions/:date` | Remove a date exception and restore regular hours |
| GET, POST | `/api/v1/tags` | Search shared vocabulary with `q`; create a tag |
| GET | `/api/v1/availability` | Search events and places available at a concrete instant near a point |

Collections accept `limit` (1–100, default 50) and `offset` (0–10000).
Discovery accepts `west`, `south`, `east`, and `north` as degrees; a west value
greater than east crosses the antimeridian. `/discovery` accepts `limit` (1–100,
default 100), a UUID `cursor`, and an optional category. It returns `items`,
`hasMore`, and `nextCursor`, with source release and `hoursState: "unknown"` on
each POI. Items are ordered by distance from the center of the requested map
bounds, then by ID; a cursor continues that order for the same bounds and
category. `/discovery/clusters` accepts integer `zoom` (0–22) and the same
category filter. It returns at most 500 cells and sets `capped` if more exist.
At zooms 0–5, a completed catalog uses a precomputed fine-cell summary; edge
cells make those counts approximate, and `approximate` is true. Zoom in for
individual POIs and exact list results.
Both responses include `catalogStatus`: `empty` before any import, `importing`
during a bootstrap or refresh, and `ready` after a completed import. Results
can change while the catalog is importing.
Only active public catalog sources with an open or unspecified operating status
appear. Unknown hours do not imply that a place is open now.
The landmarks category excludes generic Overture `historic_site` records because
many describe ordinary residences; typed landmarks such as monuments, castles,
forts, and lighthouses remain eligible.
Tag search returns up to 100 definitions without private assignment counts.
Event details include rules/templates, tags, location, and default prices.
Occurrence details include days, location, and edition-specific prices.
Place details include schedules, exceptions, tags, location, and prices.

PUT is replacement, not a patch. Omitted optional descriptions become null;
omitted tag/price/day arrays become empty. Event/place visibility defaults to
private, so send the desired visibility explicitly on replacement. Places keep
hours and exceptions through metadata replacement; their dedicated routes edit
those schedules. Deleting a place referenced by an event returns a conflict.

## Example: one fair, three days

Create the event with `POST /api/v1/events`:

```json
{
  "title": "Autumn Craft Fair",
  "visibility": "public",
  "timezone": "America/New_York",
  "location": {
    "label": "Town square",
    "latitude": 40.0,
    "longitude": -75.0
  }
}
```

To attach an existing place, supply `placeId` instead of `location`. Public
events require a public place. A private place can be attached only by its
owner. The same visibility invariant applies to occurrence venue overrides and
to subsequent event/place visibility changes.

Create the edition with `POST /api/v1/events/:eventId/occurrences`:

```json
{
  "datePrecision": "exact",
  "days": [
    { "date": "2026-09-18", "timeKind": "timed", "startMinute": 540, "endMinute": 1020, "description": "Workshops" },
    { "date": "2026-09-19", "timeKind": "timed", "startMinute": 540, "endMinute": 1020 },
    { "date": "2026-09-20", "timeKind": "timed", "startMinute": 540, "endMinute": 900, "description": "Closing day" }
  ]
}
```

Minutes are local wall time after the start date's midnight: 540 = 09:00,
1020 = 17:00. An end of 1560 means 02:00 the following day. There is one interval
per event day, with a unique date within the occurrence. `all_day` and `unknown`
days omit both minute fields. Unknown hours are not treated as available.
Exact timestamps and the occurrence's enclosing date range are derived on write.

A provided occurrence `placeId` or standalone `location` overrides the default.
When omitted on replacement, its existing venue/zone stays intact. A place's
current location can change without moving stored historical occurrences.
Event metadata defaults apply to virtual recurrence results; editing those
may change unmaterialized results. Store an explicit edition to preserve its
particular venue, timezone, title, or description.

## Recurrence and placeholders

```json
{
  "mode": "scheduled",
  "anchorDate": "2026-09-18",
  "rrule": "FREQ=YEARLY;INTERVAL=2",
  "days": [
    { "dayOffset": 0, "timeKind": "timed", "startMinute": 540, "endMinute": 1020 },
    { "dayOffset": 1, "timeKind": "timed", "startMinute": 540, "endMinute": 1020 },
    { "dayOffset": 2, "timeKind": "timed", "startMinute": 540, "endMinute": 900 }
  ]
}
```

Supported rule parts: `FREQ` (DAILY/WEEKLY/MONTHLY/YEARLY), `INTERVAL`, `BYDAY`,
`BYMONTHDAY`, `BYMONTH`, `BYSETPOS`, `WKST`, and `COUNT`. An optional `untilDate`
is inclusive for the occurrence anchor. Rules have one canonical RRULE string;
sub-day rules, embedded DTSTART/TZID, and RRULE UNTIL are rejected. Dates are
limited to 1900–2200, templates to 366 days, and intervals/counts are bounded.
Invalid calendar dates are skipped by the recurrence library, not clamped.

Generated results have a stable ID of `recurrenceId:originalAnchor` and are not
stored indefinitely. To move/cancel one, POST an occurrence with its
`recurrenceId`, `originalAnchor`, exact days, and desired status. Subsequent PUTs
must retain those original identifiers. The stored row replaces the virtual
one, even when moved elsewhere. The occurrence collection lists stored records;
use availability search to include generated ones. End a rule before adding a
replacement segment; active explicit editions beyond the proposed end must be
cancelled first.

For dates not yet announced, POST a recurrence like:

```json
{ "mode": "expected", "anchorDate": "2026-09-18", "intervalMonths": 24 }
```

This creates one tentative September 2028 placeholder. It never appears as
available on September 1. Confirm it by PUTting exact days and `status: scheduled`
to that same occurrence ID, retaining its original recurrence identifiers.
Confirmation creates the next month placeholder within the rule's end, if any.
No infinite future calendar is materialized.

## Hours, prices, and availability

Seasonal schedules have `validFrom`, optional exclusive `validTo`, and
`weekdays` (ISO 1=Monday, 7=Sunday). Each weekday has `state` (`open`, `closed`,
`unknown`) and `intervals`, each containing `startMinute`/`endMinute`. Open days
require intervals; closed/unknown days prohibit them. An exception has `date`,
`state`, optional `note`, and `intervals`. Seasons and same-day intervals must
not overlap. A date exception replaces regular hours and suppresses the previous
day's spillover into that date. Missing schedule data means unknown.

Event/place `prices` are optional. Each row has an exact decimal string `amount`,
three-letter `currency`, `validFrom`, optional exclusive `validTo`, optional
`weekdays`, `startMinute`/`endMinute` within 0–1440, plus `label`, `category`, and
`coverage` (`admission`, `day`, `occurrence`). Omitted filters mean all weekdays
and the whole day. Split overnight price windows into two dated/weekday windows.
Defaults are Admission/general/admission. Prices with the same label/category/
coverage cannot have overlapping windows at the same scope. An applicable
occurrence price replaces the matching event price; zero explicitly means free.
Place fees remain separate and are never automatically added to event fees.

Example query:

```text
GET /api/v1/availability?at=2026-09-20T14:30:00Z&latitude=40&longitude=-75&radiusMeters=25000
```

`at` must include Z or an explicit UTC offset; URL-encode a `+` offset. Each
record's stored IANA timezone determines its local schedule and current prices.
Event default prices use the event timezone; edition-specific prices use the
occurrence timezone.
Opening is inclusive, closing exclusive. The response contains `at`, `items`,
`total`, and `hasMore`; each item identifies its event occurrence or place,
location ID and coordinates, matching times, and applicable prices. Result order is title, kind,
then ID. Availability means open/running, not ticket inventory or late admission.

Spatial filtering uses PostGIS. Stored event days use an indexed timestamp
range. Recurring events and seasonal place hours are evaluated within the query
window. Search pagination occurs after all eligibility checks and overrides.
A consistent read transaction protects against mixing schedule revisions.
Unknown hours, tentative editions, month placeholders, and cancelled editions
are excluded. Timed event inputs in daylight-saving gaps/folds are rejected;
recurring timed occurrences at those ambiguous/nonexistent wall times are
omitted. Place wall times use Temporal's compatible resolution. All-day event
bounds follow local midnight, including 23- and 25-hour days.

The initial search limits radius to 100 km and rejects overly dense searches
(above 500 nearby scheduled recurrence segments, 500 places, or 2000 matching
stored day rows) with 422 rather than silently truncating. Narrow the radius.
This bounds MVP work; benchmark dense datasets before replacing these limits
with a maintained availability projection.

## Validation and testing

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm db:check`.
The normal Vitest command skips database integration without
`TEST_DATABASE_URL`. Point `TEST_DATABASE_URL` at a disposable PostGIS database
whose name ends in `_test`, then run `pnpm test:db`. That suite applies migrations
and checks the domain services, auth persistence, and database constraints.

The Playwright API project checks real HTTP routes, including authenticated
domain writes, bearer revocation, CORS, ownership, and legacy paths. It requires
the app and test runner to use the same disposable PostGIS database. Set
`DATABASE_URL`, `TEST_DATABASE_URL`, `TEST_API_URL`, `BETTER_AUTH_URL`, and
`BETTER_AUTH_SECRET`, plus test values for `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` and `API_ALLOWED_ORIGINS=http://localhost:4321`. Run
`pnpm exec playwright test test/e2e/api --project=api`. CI provisions PostGIS and
runs both suites automatically.

The generated geography column requires `geography(Point,4326)` as an SQL type;
Drizzle Kit 0.31 emits quotes around the entire custom type, so migration 0001
corrects that spelling. Review future generated geography changes. SQL-only
exclusion constraints and triggers live in explicit custom migrations, beyond
what Drizzle's schema generator models.
