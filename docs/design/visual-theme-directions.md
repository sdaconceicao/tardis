# Visual theme directions

Status: Design exploration. Sky Atlas was selected for the current frontend
shell; the other directions remain references, not active implementation plans.
The map and calendar behavior below is proposed and is still represented by
placeholders in the app.

Three treatments of the same public discovery page, based on the calendar and map wire. These explore 1930s–1950s aviation, travel timetables, Art Deco, and streamlined industrial design. The typefaces are contemporary choices that evoke the references; they are not presented as TWA's historical fonts.

## Shared layout and behavior

- Left sidebar lists events and places; selecting a listing reveals its details.
- Map and calendar share the date range and listings. Multi-day events retain separate daily hours.
- Month, week, and agenda views. Below 800px, the weekly time grid becomes a day picker and agenda. On phones, places follow the day's events and the map's list follows the map.
- Rightmost avatar opens login. Logged-out Add event opens signup before event creation.
- System appearance by default, with a visible light/dark switch. Each mode has explicitly chosen text, surface, map, action, and event colors.
- Source Sans 3 for controls and body text. Display lettering is reserved for branding, dates, and section headings.
- Shapes and rules carry the visual identity; no decorative photographs, poster backgrounds, or textures.

## 01 · Transcontinental

Closest to an airline timetable. Barlow Condensed headings and an italic uppercase wordmark; red masthead, warm paper, narrow rules, and squared controls. The event blocks use a red leading edge.

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#FAF3E6` | `#181B21` |
| Text | `#232B34` | `#F2E8D8` |
| Action | `#A62C25` | `#FF8D79` |
| Sidebar | `#F0E5D4` | `#202733` |
| Masthead | `#A62C25` | `#222833` |

Best when the desired identity is direct, energetic, and recognizably aviation-inspired. The large red masthead makes the strongest brand statement in light mode.

## 02 · Streamline

Strongest Art Deco treatment. Poiret One headings, petrol teal, copper-colored trim, double rules, and a single curved corner on event blocks and the primary header action. Body text remains a practical sans serif.

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#F0EBDF` | `#101F23` |
| Text | `#173B40` | `#E8E7DA` |
| Action | `#215660` | `#DBAD82` |
| Sidebar | `#E2E3D8` | `#172E34` |
| Masthead | `#1C414A` | `#172E36` |

Best when the product should feel like a travel lounge or streamlined instrument panel. The delicate display face needs to stay large; use Source Sans 3 for operational labels.

## 03 · Sky Atlas

Selected direction for the current shell. Josefin Sans headings combine the geometric character of Streamline with Transcontinental's clear action hierarchy. Warm ivory, blue-green navigation, red actions in light mode, brass rules, and a restrained striped wordmark.

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#F7F0DF` | `#14262C` |
| Text | `#153B45` | `#EFEBD9` |
| Action | `#AC3226` | `#EFAD81` |
| Sidebar | `#EEE4CD` | `#1A3038` |
| Trim | `#9C792B` | `#CAB366` |

The warm action color in dark mode is intentionally lighter to stay readable against deep teal. Navigation and event surfaces remain distinct from the Add event action.
