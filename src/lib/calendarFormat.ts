import { FARM_SECTIONS } from "@/lib/constants";

export type RawActivity = {
  id: string;
  farmId: string;
  date: string;
  type: "FERTILIZER" | "MULCHING" | "PLANTING" | "LAND_PREP" | "SPRAYING" | "MOWING" | "BAILING";
  product: string | null;
  rate: number | null;
  method: string | null;
  depth: number | null;
  mix: { crop: string; variety: string | null; rate: number; unit: string }[] | null;
  chemicals: { name: string; rate: number; unit: string }[] | null;
  sprayPurpose: string | null;
  bales: number | null;
  notes: string | null;
  paddock: { code: string; sizeHa: number | null };
  farm: { name: string; slug: string };
};
export type RawWalk = {
  id: string;
  farmId: string;
  date: string;
  cover: number;
  paddock: { code: string; sizeHa: number | null };
  farm: { name: string };
};

// One walk sheet (a farm's whole day of pasture-walk readings) collapsed
// into a single calendar entry — showing 20-30 individual paddock readings
// per day was too much clutter. Click through to the pasture walk screen
// (pre-loaded to that farm + date) to see or edit the actual readings.
export type WalkGroup = {
  farmId: string;
  farmName: string;
  date: string;
  count: number;
};

export type RawGrazing = {
  groupId: string;
  groupName: string;
  farmName: string;
  date: string;
  count: number | null;
  dayPaddockCode: string | null;
  nightPaddockCode: string | null;
};

// One buyer's collection — a farm can have several of these on the same
// day (different buyers), so the calendar sums them per farm+day; see
// MilkSaleGroup below.
export type RawMilkSale = {
  id: string;
  farmId: string;
  date: string;
  litres: number;
  takenBy: string | null;
  farm: { name: string };
};

// A farm's total litres sold for one day, summed across every buyer's
// collection that day — the calendar only cares about the total, not who
// took it.
export type MilkSaleGroup = {
  farmId: string;
  farmName: string;
  date: string;
  totalLitres: number;
};

// One product+rate application collapsed into a single calendar entry —
// fertilizer usually goes out across a whole section at once, so one row
// per paddock would bury the rest of the day's entries under 20-80 nearly
// identical lines. Edit/delete an individual paddock's entry from the farm
// map instead; this is a read-only summary, same as the grazing rows.
export type FertilizerGroup = {
  farmId: string;
  farmName: string;
  date: string;
  product: string | null;
  rate: number | null;
  paddockCodes: string[];
  memberIds: string[];
};

// One planting batch (same farm, same day, same seed mix) collapsed into a
// single calendar entry — mirrors FertilizerGroup, so a whole pivot planted
// together shows as one row (e.g. "P-Pivot") instead of one per camp. Edit
// or delete an individual paddock's entry from the farm map instead; this
// is a read-only summary, same as the fertilizer rows.
export type PlantingGroup = {
  farmId: string;
  farmName: string;
  date: string;
  mix: { crop: string; variety: string | null; rate: number; unit: string }[] | null;
  paddockCodes: string[];
  memberIds: string[];
};

export type CalendarEvent = {
  id: string;
  farmName: string;
  label: string;
  raw: RawActivity | WalkGroup | RawGrazing | MilkSaleGroup | FertilizerGroup | PlantingGroup;
  isWalk: boolean;
  isGrazing?: boolean;
  isWalkGroup?: boolean;
  isMilkSale?: boolean;
  isFertilizerGroup?: boolean;
  isPlantingGroup?: boolean;
};

// Collapses a list of paddock codes sharing the same treatment into a
// compact label: consecutive numeric runs become "R1-25", and a run that
// exactly matches one of the farm's named sections (see FARM_SECTIONS)
// shows that name instead — e.g. "Main Drag Lines" rather than "R1-25".
// Anything that doesn't parse as a prefix+number (an odd one-off code)
// just gets listed as-is.
export function formatPaddockGroup(codes: string[], farmSlug: string): string {
  const parsed = codes.map((code) => {
    const m = code.match(/^([A-Za-z]*)(\d+)$/);
    return m ? { code, prefix: m[1], num: parseInt(m[2], 10) } : null;
  });
  const numeric = parsed.filter((p): p is { code: string; prefix: string; num: number } => p != null);
  const numericCodes = new Set(numeric.map((p) => p.code));
  const nonNumeric = codes.filter((c) => !numericCodes.has(c));

  const byPrefix = new Map<string, number[]>();
  for (const p of numeric) byPrefix.set(p.prefix, [...(byPrefix.get(p.prefix) ?? []), p.num]);

  const pieces: string[] = [];
  for (const [prefix, nums] of byPrefix) {
    const sorted = [...new Set(nums)].sort((a, b) => a - b);
    let runStart = sorted[0];
    let runEnd = sorted[0];
    const flushRun = () => {
      const runCodes: string[] = [];
      for (let i = runStart; i <= runEnd; i++) runCodes.push(`${prefix}${i}`);
      const section = FARM_SECTIONS.find(
        (s) => s.farmSlug === farmSlug && s.codes.length === runCodes.length && s.codes.every((c, idx) => c === runCodes[idx])
      );
      if (section) pieces.push(section.name);
      else if (runStart === runEnd) pieces.push(`${prefix}${runStart}`);
      else pieces.push(`${prefix}${runStart}-${runEnd}`);
    };
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === runEnd + 1) runEnd = sorted[i];
      else { flushRun(); runStart = sorted[i]; runEnd = sorted[i]; }
    }
    flushRun();
  }
  pieces.push(...nonNumeric);
  return pieces.join(", ");
}

export function fertilizerGroupLabel(g: FertilizerGroup, farmSlug: string): string {
  const rate = g.rate ? ` ${g.rate}kg/ha` : "";
  return `Fertilizer — ${g.product ?? ""}${rate} — ${formatPaddockGroup(g.paddockCodes, farmSlug)}`;
}

export function plantingGroupLabel(g: PlantingGroup, farmSlug: string): string {
  const mix = g.mix?.map((m) => `${m.rate}${m.unit} ${m.crop}${m.variety ? ` (${m.variety})` : ""}`).join(", ") ?? "";
  return `Planting${mix ? ` — ${mix}` : ""} — ${formatPaddockGroup(g.paddockCodes, farmSlug)}`;
}

export const TYPE_LABEL: Record<string, string> = {
  FERTILIZER: "Fertilizer",
  MULCHING: "Mulching",
  PLANTING: "Planting",
  LAND_PREP: "Land prep",
  SPRAYING: "Spraying",
  MOWING: "Mowing for bailing",
  BAILING: "Bailing",
};

export function activityLabel(a: RawActivity): string {
  const name = TYPE_LABEL[a.type] ?? a.type;
  switch (a.type) {
    case "FERTILIZER":
      return `${name} — ${a.product ?? ""}${a.rate ? ` ${a.rate}kg/ha` : ""} — ${a.paddock.code}`;
    case "LAND_PREP":
      return `${name} — ${a.method ?? ""}${a.depth ? ` (${a.depth}cm)` : ""} — ${a.paddock.code}`;
    case "PLANTING": {
      const mix = a.mix?.map((m) => `${m.rate}${m.unit} ${m.crop}${m.variety ? ` (${m.variety})` : ""}`).join(", ") ?? "";
      return `${name}${mix ? ` — ${mix}` : ""} — ${a.paddock.code}`;
    }
    case "SPRAYING": {
      const chems = a.chemicals?.map((c) => c.name).join(", ") ?? "";
      const purpose = a.sprayPurpose ? ` (${a.sprayPurpose})` : "";
      return `${name}${purpose}${chems ? ` — ${chems}` : ""} — ${a.paddock.code}`;
    }
    case "BAILING":
      return `${name} — ${a.product ?? ""}${a.bales ? ` × ${a.bales}` : ""} — ${a.paddock.code}`;
    default:
      return `${name} — ${a.paddock.code}`;
  }
}

export function walkGroupLabel(g: WalkGroup): string {
  return `${g.farmName} Pasture walk`;
}

export function milkSaleGroupLabel(g: MilkSaleGroup): string {
  return `Total milk sold — ${g.totalLitres}L`;
}

// "A (510) — R49 Day, Night" when day/night share a camp, or
// "A (511) — R49 Day, R26 Night" when they don't. Headcount is omitted if
// none has been logged yet.

export function grazingLabel(g: RawGrazing): string {
  const countPart = g.count != null ? ` (${g.count})` : "";
  const parts: string[] = [];
  if (g.dayPaddockCode && g.dayPaddockCode === g.nightPaddockCode) {
    parts.push(`${g.dayPaddockCode} Day, Night`);
  } else {
    if (g.dayPaddockCode) parts.push(`${g.dayPaddockCode} Day`);
    if (g.nightPaddockCode) parts.push(`${g.nightPaddockCode} Night`);
  }
  return `${g.groupName}${countPart} — ${parts.join(", ")}`;
}

export function eventsFromCalendarData(
  data: { activities: RawActivity[]; walks: RawWalk[]; grazing?: RawGrazing[]; milkSales?: RawMilkSale[] } | null
): CalendarEvent[] {
  const allActivities = data?.activities ?? [];
  const fertActivities = allActivities.filter((a) => a.type === "FERTILIZER");
  const plantActivities = allActivities.filter((a) => a.type === "PLANTING");
  const otherActivities = allActivities.filter((a) => a.type !== "FERTILIZER" && a.type !== "PLANTING");
  const acts = otherActivities.map((a) => ({ id: a.id, farmName: a.farm.name, label: activityLabel(a), raw: a, isWalk: false }));

  const plantGroupMap = new Map<string, PlantingGroup & { farmSlug: string }>();
  for (const a of plantActivities) {
    const date = a.date.slice(0, 10);
    const key = `${a.farmId}|${date}|${JSON.stringify(a.mix)}`;
    const existing = plantGroupMap.get(key);
    if (existing) { existing.paddockCodes.push(a.paddock.code); existing.memberIds.push(a.id); }
    else plantGroupMap.set(key, { farmId: a.farmId, farmName: a.farm.name, farmSlug: a.farm.slug, date, mix: a.mix, paddockCodes: [a.paddock.code], memberIds: [a.id] });
  }
  const plantGroups: CalendarEvent[] = [...plantGroupMap.values()]
    .sort((a, b) => (Math.min(...a.paddockCodes.map(numPart)) - Math.min(...b.paddockCodes.map(numPart))))
    .map((g) => ({
      id: `plant-${g.farmId}-${g.date}-${JSON.stringify(g.mix)}`,
      farmName: g.farmName,
      label: plantingGroupLabel(g, g.farmSlug),
      raw: g,
      isWalk: false,
      isPlantingGroup: true,
    }));

  const fertGroupMap = new Map<string, FertilizerGroup & { farmSlug: string }>();
  for (const a of fertActivities) {
    const date = a.date.slice(0, 10);
    const key = `${a.farmId}|${date}|${a.product ?? ""}|${a.rate ?? ""}`;
    const existing = fertGroupMap.get(key);
    if (existing) { existing.paddockCodes.push(a.paddock.code); existing.memberIds.push(a.id); }
    else fertGroupMap.set(key, { farmId: a.farmId, farmName: a.farm.name, farmSlug: a.farm.slug, date, product: a.product, rate: a.rate, paddockCodes: [a.paddock.code], memberIds: [a.id] });
  }
  const fertGroups: CalendarEvent[] = [...fertGroupMap.values()]
    .sort((a, b) => (Math.min(...a.paddockCodes.map(numPart)) - Math.min(...b.paddockCodes.map(numPart))))
    .map((g) => ({
      id: `fert-${g.farmId}-${g.date}-${g.product}-${g.rate}`,
      farmName: g.farmName,
      label: fertilizerGroupLabel(g, g.farmSlug),
      raw: g,
      isWalk: false,
      isFertilizerGroup: true,
    }));

  const walkGroups = new Map<string, WalkGroup>();
  (data?.walks ?? []).forEach((w) => {
    const date = w.date.slice(0, 10);
    const key = `${w.farmId}|${date}`;
    const existing = walkGroups.get(key);
    if (existing) existing.count += 1;
    else walkGroups.set(key, { farmId: w.farmId, farmName: w.farm.name, date, count: 1 });
  });
  const walks: CalendarEvent[] = [...walkGroups.values()].map((g) => ({
    id: `walk-${g.farmId}-${g.date}`,
    farmName: g.farmName,
    label: walkGroupLabel(g),
    raw: g,
    isWalk: true,
    isWalkGroup: true,
  }));
  const grazing = (data?.grazing ?? []).map((g) => ({
    id: `grazing-${g.groupId}-${g.date}`,
    farmName: g.farmName,
    label: grazingLabel(g),
    raw: g,
    isWalk: false,
    isGrazing: true,
  }));
  const milkSaleGroups = new Map<string, MilkSaleGroup>();
  (data?.milkSales ?? []).forEach((m) => {
    const date = m.date.slice(0, 10);
    const key = `${m.farmId}|${date}`;
    const existing = milkSaleGroups.get(key);
    if (existing) existing.totalLitres += m.litres;
    else milkSaleGroups.set(key, { farmId: m.farmId, farmName: m.farm.name, date, totalLitres: m.litres });
  });
  const milkSales: CalendarEvent[] = [...milkSaleGroups.values()].map((g) => ({
    id: `milk-sale-${g.farmId}-${g.date}`,
    farmName: g.farmName,
    label: milkSaleGroupLabel(g),
    raw: g,
    isWalk: false,
    isMilkSale: true,
  }));
  // Within a day, grazing (cows) and milk sold lead — watched every day, must
  // never be buried — then mulching, then everything else, then fertilizer
  // last (there can be a lot of it, and it's rarely the thing someone's
  // checking the calendar for). Sort is stable so ties keep their original
  // relative order.
  const priority = (e: CalendarEvent): number => {
    if (e.isGrazing || e.isMilkSale) return 0;
    if (e.isFertilizerGroup) return 3;
    if (!e.isWalk && !e.isPlantingGroup && (e.raw as RawActivity).type === "MULCHING") return 1;
    return 2;
  };
  return [...acts, ...walks, ...grazing, ...milkSales, ...plantGroups, ...fertGroups].sort((a, b) => priority(a) - priority(b));
}

// Trailing numeric part of a paddock code (R41 -> 41), for ordering by
// farm position; codes with no trailing number sort last.
function numPart(code: string): number {
  const m = code.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : Infinity;
}

// Pure calendar-date arithmetic in UTC throughout (parse and format both as
// UTC) so this never drifts a day depending on the viewer's timezone offset —
// mixing a local-time parse with a UTC-formatted output was shifting every
// date back by a day (compounding to 2 days across start + per-day calls).
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
