# Public discovery frontend — initial layout plan

Status: Design proposal, 2026-09-10. The layouts use fictional sample listings;
they are not a working frontend or live event data. The current app has map and
calendar placeholders. The [event/place design](event-place-schema.md) and
[API guide](../api/domain-endpoints.md) describe the implemented schema and
HTTP endpoints. Date-range discovery and national map browsing remain proposed.

Earlier interactive wireframes (not stored in this repository) cover mobile and
desktop, with alternate
layouts and local/national location states. Date/type/time filtering, list
expansion, pin selection, and event details use a small fixture dataset.
Geolocation is simulated; city search is represented by an area selector. Map
pan/zoom, drag gestures, authentication, URL history, and live queries remain
implementation work. Map geometry is published Census/us-atlas and Boston
Planning Department data; sample listings use neighborhood-level positions.

## Recommended direction

Make the logged-out homepage an immediately usable map. The primary question is
“What is happening here during these dates?” A second, explicit time mode answers
“What is open or running at this moment?” Browsing, filtering, reading details,
and sharing discovery links do not require an account.

Use a map with an expandable bottom results sheet on phones. At wider widths,
turn that same results area into a persistent left sidebar. Keep the map,
results, and selected item synchronized. Event details replace the results in
the same panel; Back restores the list, scroll position, filters, and map view.

Events are the default. Offer Events / Places / All as a single content switch.
This preserves events as the core of the product without hiding permanent
destinations. A place can exist without an event; an event can have a temporary
location without a place page.

## Layout alternatives

| Direction | Phone | Desktop | Benefit | Cost |
| --- | --- | --- | --- | --- |
| A — map + results (recommended) | Map behind a bottom sheet; compact, half, and expanded states | Persistent 340–400px results sidebar beside map | Spatial context and scannable choices stay together | Sheet/map gestures need careful implementation |
| B — map with a selected card | Map dominates; pin opens one compact card; explicit List button | Floating results panel over map; can collapse | Strong browsing-by-location experience | Comparing many events takes more actions; panel hides map content |
| C — list with a map switch | Full-width results; persistent Map switch | Wider list, optional map | Best for reading, assistive technology, and dense results | Geography is less prominent |

Ship A with C available as a view choice. Explore B in the wireframes before
deciding whether a floating desktop panel earns its extra complexity. No
permanent navigation rail or three-column results/map/details arrangement is
needed for the initial public experience.

## Calendar refinement — 2026-10-02

Map and Calendar are two views of the same discovery area and date selection.
Both keep an event-and-place list in the left sidebar on desktop. The calendar
occupies the main pane when selected; do not squeeze a full map, calendar, and
list into three simultaneous columns.

- Offer Month, Week, and Agenda. Week shows actual daily availability intervals;
  a separate multi-day label links the fair's Friday, Saturday, and Sunday
  blocks without suggesting it is open overnight. Month summarizes its three
  days; selecting any segment highlights the same event in the list.
- Keep unknown-hour events in an explicitly labeled “Time TBA” lane. A
  month-only expectation must not be placed into a fabricated calendar date.
- Keep places in a separate “Places to visit” list section. Selecting a day
  resolves their opening hours. Do not fill the event calendar with every
  place's recurring business hours.
- Selecting a date narrows the list, with an obvious “Whole period” action.
  Switching between Map and Calendar preserves dates and selection. Selected
  entries can expand their daily schedule inline while the list remains visible.
- At tablet widths, prefer a readable agenda beside the list to seven cramped
  time columns. On phones, use a compact week/date selector and daily agenda;
  nearby places follow below. The map view uses the same list below its map.
- Place a labeled, high-contrast **Add event** button in the global header in
  both views. Keep its full text visible on phones. Do not bury it inside a
  calendar cell, overflow menu, or sign-in screen.
- Put a circular account/avatar button at the far right of the header, after
  Add event, on desktop and mobile. For signed-out users it opens Sign in,
  with a Sign up alternative; remove the “Browsing as guest” label.
- The logged-out flow is Add event → Sign up → event editor after successful
  authentication. Offer Sign in for existing users on the signup screen.
  Preserve the return destination and discovery context. Authentication comes
  before entering event details. Signed-in users go directly to the editor.
  The wireframe shows signup/login layouts without real authentication;
  recurrence, additional days, venue validation, draft persistence, and
  authenticated publication remain implementation work.

The October calendar wireframe uses fictional events and the previously sourced
Boston map geometry. Calendar/list/map selection and the event draft preview
are local interactions; no event is published.

## Responsive layout

| Width (starting hypotheses) | Layout |
| --- | --- |
| 320–599px | Compact brand/header; full-width location field; date and filter row; map; bottom results sheet. Sign in is secondary. |
| 600–899px | Keep sheet in portrait; use split view only if at least ~360px remains for the map. Do not infer layout from device type. |
| 900px and above | Single header with location, dates, filters, sign in; fixed-width results sidebar and flexible map. Details reuse the sidebar. |
| Large desktop | Keep sidebar readable rather than scaling it with screen width; use additional space for the map. |

On a phone, start the sheet at roughly 35–40% of the content height: count,
view switch, and one complete card plus the beginning of the next. Map mode
collapses it to a compact results control. Expanded mode gives the list the
available space. Keep explicit Expand / Show map buttons as alternatives to
dragging. Move map controls and selected pins above the sheet; reserve the
device safe area. Support short landscape screens and on-screen keyboards.

## First visit and location

1. A shared URL's area/date filters take precedence, so opening a link does not
   silently recenter on the recipient.
2. Otherwise use an intentionally selected location from this browsing session,
   or an already-permitted device location. Never use an old precise location
   as if it were current without checking it.
3. Without a provided location, show the United States with aggregate event
   markers. Fit the contiguous states and provide labeled Alaska/Hawaii access
   or insets; all states must remain searchable.
4. Provide a visible “Use my location” action alongside city/ZIP search. Request
   browser permission after that action, not in a blocking first-load modal.
5. Denial, timeout, or unavailable positioning leaves the national view usable:
   “Location unavailable. Search a city or ZIP.” Manual search remains available.

National clusters lead into regions, then individual events. The national
sidebar prompts area selection and summarizes actual search coverage; it must
not present an arbitrary first page as a complete nationwide list. Counts
represent matching occurrences, not event-day rows. Do not display invented
counts, popularity, or a “near you” label when no origin exists.

Default dates: Today in the browser's local calendar, clearly visible and easy
to change. Quick choices: Today, Tomorrow, This weekend, Custom range. A future
trip selected in a URL or the current session must survive navigation.

## Map, cards, and navigation

- Cluster close points at broad zooms. Events use round numbered markers;
  places use a distinct shape and an explicit Place label. Selection uses an
  outline and text, not color alone.
- One multi-day occurrence is one result and one map item. Show “Sep 18–20”
  plus the next matching day's hours; the detail view reveals each day's hours
  and description. Multiple editions of a recurring event can be separate
  results, with “More dates” linking them under the event identity.
- Several events at the same venue open a small venue-results group when zoom
  cannot separate them. Do not stack inaccessible pins at the same coordinate.
- Tapping a pin selects its matching card; tapping a card opens details and
  keeps the marker highlighted. Desktop hover can preview the relationship,
  but the same behavior must be available through keyboard and touch.
- Panning exposes “Search this area.” Keep current results stable until the
  user commits the new bounds. Mark them as belonging to the previous area
  while that action is pending. Zooming into a cluster is an explicit search
  action and can fetch immediately. Abort obsolete requests.
- Define “Nearest” relative to a visible origin. With no device/manual origin,
  use “Distance from map center” if offered. Initial local order can be soonest
  matching start, then distance, with a stable ID tie-breaker. Expose a modest
  Soonest / Nearest choice only once supported by the query contract.
- Browser Back closes details before leaving discovery. Preserve a shareable
  area, dates, time mode, timezone, content kind, tags, and selection in the URL.
  Do not put a precise device position in a public share URL by default; share
  the chosen area or a deliberately rounded map center.

Card content, in reading order: event/place label and date; title; location;
relevant hours; price summary; at most two useful tags. Photos are optional
later. Cards must work without images, distance, prices, or known hours.

Detail content: Back; title/status; occurrence dates; matching day's schedule;
all days with their descriptions; address and optional linked place; separately
labeled event and place prices; tags and description. Directions can open an
external maps destination. Do not show invented travel times: the routing
contract has no live provider. Ticket links, save flows, and ratings are
outside the current shell.

## Date and time semantics

Date ranges shown to people are inclusive: Sep 18–20 includes Sunday. Query
conversion must respect each record's timezone and the server's exclusive
end boundary; it must not add an arbitrary 24 hours across daylight-saving
changes. National date browsing uses each event's local calendar date, showing
the venue timezone where comparisons could be ambiguous.

In date mode, match actual event days, not just an occurrence's enclosing date
span. An exact-date event with unknown hours can appear as “Hours not announced.”
For places, show “Open during selected dates” only if at least one opening
interval overlaps; unknown schedules belong in an explicitly labeled optional
“Include unknown hours” category. Do not imply continuous opening across a range.

Time mode requires a single date, time, and named timezone. “Open / running at”
queries a concrete instant everywhere on the map. Entering time mode from a
range requires choosing a day within that range; it must not silently test the
same wall time on every date. Going back to date mode restores the range.
An event underway is not necessarily accepting late admission.

| Data condition | Public treatment |
| --- | --- |
| Exact dates, unknown hours | Date browsing: “Hours not announced”; exclude from time availability |
| Explicit all-day event | Show “All day”; do not infer this from missing hours |
| Overnight event | Show “Fri 10pm–Sat 2am”; match the Saturday portion too |
| Tentative exact dates | Optional date-browse results, labeled Tentative; never claim available |
| Expected month only | Separate opt-in “Dates not announced” results in month browsing; “Expected September 2027,” never September 1 |
| Cancelled | Remove from normal discovery; retain a clearly cancelled detail page for old links |
| Seasonal closure | Resolve the requested date's hours and exceptions, not today's schedule |
| Missing price | “Price not listed,” never Free |
| Explicit zero admission | Free admission; do not imply all optional fees are zero |
| Several applicable prices | Audience/coverage labels; show a range only when it honestly describes applicable admission |
| Event hosted by a paid place | Separate event and venue admission lines; do not add them or assume inclusion |

## Empty, loading, and accessible states

Keep filters and the map visible during loading; provide skeleton results and
a concise result announcement when the request completes. A failed basemap
must leave the list usable. A failed query has Retry and retains the user's
search. A stale response must not overwrite a newer selection.

Zero results should say which area/dates were searched, with explicit actions
to widen the area, change dates, clear filters, or include places. Never silently
broaden the search. Dense-query limits should ask the user to zoom in, not report
“No events.” Distinguish no matches from no data coverage when coverage is known.

Use approximately 44px touch targets, visible focus, labeled controls, and a
complete list alternative to the map. Announce result counts/selection changes,
not map animation frames. When details open, focus their heading; on Back return
focus to the originating card. A modal mobile filter/date dialog contains focus,
supports Escape/Close, and restores focus. Essential actions never require
hover or dragging. Avoid thousands of individual marker tab stops.

## Backend work required for these layouts

The existing `/api/v1/availability` handles a concrete instant within a maximum
100 km radius. It does not support date ranges, viewport searches, national
clusters, or all of the proposed card metadata. Event collections return event
identities; stored occurrence collections omit virtual recurring editions.
Fetching those collections alone cannot power correct discovery.

Propose a public discovery read contract owned by the planning capability,
using public entry points of events, places, and taxonomy. Keep this within the
existing modular monolith. Endpoint names below are
proposals, not implemented routes:

- `GET /api/v1/discovery`: bounds or center/radius; date range OR instant;
  kind/tags; explicit uncertain-data options; ordering; cursor. Return
  occurrence/place identities, effective venue coordinates, matching days or
  hours, status, price summary, tags, and pagination information.
- `GET /api/v1/discovery/clusters`: same eligibility filters plus zoom/bounds;
  aggregated points, count semantics, and expansion bounds. Do not download the
  national dataset to cluster it in the browser. Benchmark a bounded query
  approach; add materialization only if needed, with documented freshness.
- Resolve a selected generated occurrence using its stable recurrence/anchor
  identity. An occurrence detail route must support virtual results and keep
  links usable when a generated occurrence is promoted to a stored override.

Apply visibility and recurrence overrides before counting and pagination. A
date-range query needs bounded recurrence expansion, overnight lookback, and
actual-day matching. Share eligibility between clusters and result lists so
counts do not contradict the panel. Report incomplete/capped results honestly.
Coordinates must come from the occurrence's effective venue, not automatically
the place's current address. Batch card enrichment to avoid per-card requests.

## Suggested implementation order

1. Review A/B/C layouts and the location/date/time defaults using fixtures.
   Exercise the map → card → details → Back journey on phone and desktop.
2. Define discovery/list/cluster contracts and implement the minimum backend
   needed for date-window and national browsing. Validate counts, recurring
   overrides, unknown data, and public-only serialization.
3. Build the responsive discovery shell with TanStack routing, MapLibre, and
   Lago directly, following ADR 0003. Product compositions can include
   DiscoveryToolbar, ResultsPanel, DiscoveryCard, and OccurrenceDetails; avoid
   introducing a separate generic component-wrapper layer.
4. Connect searches, location handling, URL state, selection, and failure states.
   Add time availability using the existing endpoint where its contract fits.
5. Check 320/390px phones, tablet portrait/landscape, and desktop; keyboard and
   screen-reader journeys; permission denial; sparse and dense regions; DST and
   overnight schedules; multi-day deduplication; and Back restoration.

Keep accounts, authoring, saved itineraries, and travel-time ranking for
subsequent work. Sky Atlas is the shell's current visual direction. The first
data-backed frontend milestone is anonymous
discovery with trustworthy dates, locations, and availability.
