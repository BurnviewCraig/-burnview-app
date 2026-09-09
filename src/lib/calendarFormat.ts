export type RawActivity = {
  id: string;
  date: string;
  type: "FERTILIZER" | "MULCHING" | "PLANTING" | "LAND_PREP" | "SPRAYING" | "MOWING" | "BAILING";
  product: string | null;
  rate: number | null;
  method: string | null;
  depth: number | null;
  mix: { crop: string; variety: string | null; rate: number; unit: string }[] | null;
  chemicals: { name: string; rate: number; unit: string }[] | null;
  bales: number | null;
  notes: string | null;
  paddock: { code: string; sizeHa: number | null };
  farm: { name: string };
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

export type CalendarEvent = {
  id: string;
  farmName: string;
  label: string;
  raw: RawActivity | WalkGroup | RawGrazing | MilkSaleGroup;
  isWalk: boolean;
  isGrazing?: boolean;
  isWalkGroup?: boolean;
  isMilkSale?: boolean;
};

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
      return `${name}${chems ? ` — ${chems}` : ""} — ${a.paddock.code}`;
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
  const acts = (data?.activities ?? []).map((a) => ({ id: a.id, farmName: a.farm.name, label: activityLabel(a), raw: a, isWalk: false }));

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
  // never be buried — then mulching, then everything else. Sort is stable so
  // ties keep their original relative order.
  const priority = (e: CalendarEvent): number => {
    if (e.isGrazing || e.isMilkSale) return 0;
    if (!e.isWalk && (e.raw as RawActivity).type === "MULCHING") return 1;
    return 2;
  };
  return [...acts, ...walks, ...grazing, ...milkSales].sort((a, b) => priority(a) - priority(b));
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
