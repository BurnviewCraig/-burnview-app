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
  date: string;
  cover: number;
  paddock: { code: string; sizeHa: number | null };
  farm: { name: string };
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

export type CalendarEvent = {
  id: string;
  farmName: string;
  label: string;
  raw: RawActivity | RawWalk | RawGrazing;
  isWalk: boolean;
  isGrazing?: boolean;
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

export function walkLabel(w: RawWalk): string {
  return `Pasture walk — ${w.cover} kg DM/ha — ${w.paddock.code}`;
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
  data: { activities: RawActivity[]; walks: RawWalk[]; grazing?: RawGrazing[] } | null
): CalendarEvent[] {
  const acts = (data?.activities ?? []).map((a) => ({ id: a.id, farmName: a.farm.name, label: activityLabel(a), raw: a, isWalk: false }));
  const walks = (data?.walks ?? []).map((w) => ({ id: w.id, farmName: w.farm.name, label: walkLabel(w), raw: w, isWalk: true }));
  const grazing = (data?.grazing ?? []).map((g) => ({
    id: `grazing-${g.groupId}-${g.date}`,
    farmName: g.farmName,
    label: grazingLabel(g),
    raw: g,
    isWalk: false,
    isGrazing: true,
  }));
  // Within a day, grazing (cows) leads, then mulching, then everything else —
  // sort is stable so ties keep their original relative order.
  const priority = (e: CalendarEvent): number => {
    if (e.isGrazing) return 0;
    if (!e.isWalk && (e.raw as RawActivity).type === "MULCHING") return 1;
    return 2;
  };
  return [...acts, ...walks, ...grazing].sort((a, b) => priority(a) - priority(b));
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
