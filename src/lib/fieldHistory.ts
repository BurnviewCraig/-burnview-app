import type { FieldActivity, PastureWalk, GrazingAllocation } from "@/lib/types";

export type FieldHistoryEntry = {
  id: string;
  isWalk: boolean;
  isGrazing?: boolean;
  date: string;
  type: string;
  product?: string | null;
  rate?: number | null;
  method?: string | null;
  depth?: number | null;
  mix?: FieldActivity["mix"];
  chemicals?: FieldActivity["chemicals"];
  bales?: number | null;
  notes?: string | null;
};

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

// Shared by the map's field detail panel and the full field history page —
// combines activities, pasture walks, and grazing allocations into one
// sorted list. Grazing allocations collapse a group's run of consecutive
// days (day+night included) grazing the same camp into a single row dated
// at the end of that run, rather than a row per session.
export function buildFieldHistory({
  activities,
  walks,
  grazing,
  today,
  dateFilter,
}: {
  activities: FieldActivity[];
  walks: PastureWalk[];
  grazing: GrazingAllocation[];
  today: string;
  dateFilter?: (dateISO: string) => boolean;
}): FieldHistoryEntry[] {
  const acts: FieldHistoryEntry[] = activities
    .filter((a) => !dateFilter || dateFilter(a.date))
    .map((a) => ({
      id: a.id,
      isWalk: false,
      date: a.date,
      type: a.type.replace("_", " "),
      product: a.product,
      rate: a.rate,
      method: a.method,
      depth: a.depth,
      mix: a.mix,
      chemicals: a.chemicals,
      bales: a.bales,
      notes: a.notes,
    }));

  const walkEntries: FieldHistoryEntry[] = walks
    .filter((w) => !dateFilter || dateFilter(w.date))
    .map((w) => ({
      id: w.id,
      isWalk: true,
      date: w.date,
      type: "Pasture walk",
      notes: `${w.cover} kg DM/ha`,
    }));

  // Only past/today's grazing counts as history — a few days out shows on
  // the allocation calendar as a plan, not as something that's happened yet.
  const rows = grazing
    .filter((g) => g.date.slice(0, 10) <= today && (!dateFilter || dateFilter(g.date)))
    .map((g) => ({ groupId: g.groupId, groupName: g.group.name, date: g.date.slice(0, 10), count: g.count ?? null }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const byGroup = new Map<string, typeof rows>();
  rows.forEach((r) => byGroup.set(r.groupId, [...(byGroup.get(r.groupId) ?? []), r]));
  const grazed: FieldHistoryEntry[] = [];
  byGroup.forEach((list, groupId) => {
    let spanStart = list[0];
    let spanEnd = list[0];
    const flush = () => {
      grazed.push({
        id: `grazing-${groupId}-${spanStart.date}`,
        isWalk: false,
        isGrazing: true,
        date: spanEnd.date,
        type: "Grazed",
        notes: `${spanEnd.groupName}${spanEnd.count != null ? ` (${spanEnd.count})` : ""}`,
      });
    };
    for (let i = 1; i < list.length; i++) {
      const cur = list[i];
      if (diffDays(spanEnd.date, cur.date) <= 1) {
        spanEnd = cur;
      } else {
        flush();
        spanStart = cur;
        spanEnd = cur;
      }
    }
    flush();
  });

  return [...acts, ...walkEntries, ...grazed].sort((a, b) => (a.date < b.date ? 1 : -1));
}
