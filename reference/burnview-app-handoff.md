# Burnview Group Farm App — Handoff Spec

This summarizes everything designed in the Claude chat prototype (`burnview-app-shell.jsx`), for kicking off a real build in Claude Code. The prototype is a working, in-memory UI mockup — this doc + that file together are the spec for the real version.

## Context

Three farms operated together, each with its own herd and pastures:
- **Farm 1 — Burnview** (80 paddocks, numeric codes 01–81)
- **Farm 2 — Everfair** (33 paddocks, E01–E33)
- **Farm 3 — Stockton** (30 paddocks, S01–S42, non-sequential)

All paddocks entered so far are irrigated ryegrass camps.

## Navigation structure

**Home** → Farm | Cattle | Food | Stocks | Feeding

- **Farm**
  - **Map** — all 3 farms, organic field-tile map (placeholder geometry, not real GPS). Tap a field → full history (fertilizer, mulching, planting, land prep, spraying, pasture walk readings) + nutrient totals + herd marker if occupied. Category tabs: All / Rye grass / Kikuyu / Maize / Unplanted / Unclassified.
  - **Field activities** — log Fertilizer, Mulching, Planting, Land Prep, Spraying against multiple paddocks at once (up to ~30/day), ordered paddock picker.
  - **Edit fields** — per-paddock size (ha) and classification.
- **Cattle** — not built (placeholder).
- **Food**
  - **Farm wedge** — real wedge chart per farm: cover sorted ascending ("grass tallest on right"), stacked grazing/grown bars, trend line, days-since-mulched sub-chart. Real summary figures (Wedge Cover, Weighted Avg growth, DM Produced, Avg Residual) pulled from actual wedge exports.
  - **Data entry → Pasture walk** — weekly per-paddock cover entry, ordered list + on-screen numeric keypad, feeds the wedge directly.
  - Feed budget — not built (placeholder).
- **Stocks**
  - **Feed** — Silage, Bales, Dairy meal, Soya, Super 18, Supreme 20. Use/Restock against any farm, auto-adjusts balance.
  - **Land inputs** — Fertilizer / Chemicals / Seed categories, user-defined items, same Use/Restock mechanic.
- **Feeding** — not built (placeholder; intended to eventually log against Feed stock).

## Key data model

- **Paddock**: farmId, code, cover (kg DM/ha), flagged (excluded/no data, e.g. recent replant).
- **Field activity log entry**: farmId, paddock, type (Fertilizer/Mulching/Planting/Land Prep/Spraying), date, notes, plus type-specific fields:
  - Fertilizer: product (from a fixed list — see below), rate (kg/ha)
  - Land Prep: method (Ripping/Disc/Speed Disc/Bomford = tillage; Rolling = not tillage), depth (cm)
  - Planting: seed mix (kg/ha per crop: Rye grass/Kikuyu/Maize)
- **Pasture walk entry**: farmId, paddock, date, cover (kg DM/ha) — most recent entry per paddock overrides synthetic cover everywhere.
- **Land classification**: farmId+paddock → Rye grass | Kikuyu | Maize | Unplanted | null. Auto-updates:
  - Any tillage Land Prep entry → "Unplanted"
  - Planting entry → whichever seed-mix component is the majority by weight
- **Herd marker**: farmId+paddock → group name (placeholder only — real version needs this driven by the Cattle module once built).
- **Stock item**: id, name, unit, qty. Use/Restock entries adjust qty (Use = subtract, clamped at 0).

## Fertilizer types (real, as given)

Urea, Potassium, Phosphorus, Chicken Litter, Lime, Cow Manure, Slurry, Compost, LAN, 100(40%)+S, Kynoplus Urea, Kynoplus 100(40%)+S.

**⚠️ Placeholder data — needs replacing before trusting outputs:**
- N/P/K/S % for each fertilizer type above is a generic industry-typical guess, not Craig's real product analysis. Needs real bag/spec-sheet numbers.
- Per-paddock cover values are synthetic until real pasture walks are entered.
- Herd-in-paddock assignments are placeholder examples (Cattle module doesn't exist yet).
- Field size (ha) is unset for all paddocks — needs real data via Edit Fields.

## Design language (for visual consistency)

Warm khaki/paper background (#EDEAD9), deep forest green primary (#3F6B3F), muted teal-blue for flagged/no-data states (#5C7C87), amber accents. Space Grotesk for headers/labels, IBM Plex Mono for numeric readouts. Built mobile-first, single-column, bottom-docked action panels (numeric keypad, stock entry) rather than modals.

## What the real build needs that the prototype can't provide

1. **Persistent database** — everything above currently resets on reload.
2. **Multi-user auth** — for you and whoever else enters data (workers doing pasture walks, fertilizer application, etc.).
3. **Real paddock boundaries** — GPS/KML import to replace the placeholder tile geometry.
4. **Offline support** — pasture walks and field activities often happen without signal.
5. **Real herd/Cattle data** to drive the map's herd markers properly.
6. **Real fertilizer nutrient percentages** (see above).

## Files

- `burnview-app-shell.jsx` — the working prototype (React), useful as a UI/UX reference, not meant to be deployed as-is.
