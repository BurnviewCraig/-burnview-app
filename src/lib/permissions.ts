// Section-level visibility permissions. Calendar is intentionally excluded —
// it's always visible to everyone, per Craig's instruction.
//
// sectionAccess stored on User is `null` (grandfathers full access — existing
// and newly created users default to seeing everything until an admin
// restricts them) or a concrete object. Once any key is set, missing keys
// on that object are treated as restricted, and unchecking a box in the UI
// is what produces a concrete `false`.
//
// Timebook is farm-scoped rather than a single on/off switch, since a user
// may be allowed to see one farm's book but not another's (e.g. Glen at
// Everfair shouldn't see the Stockton or Burnview books).

export const SECTION_DEFS = [
  { key: "farm", label: "Farm", sub: "Map & field activities" },
  { key: "cattle", label: "Cattle", sub: "Herds & movements" },
  { key: "food", label: "Grass", sub: "Grazing & the wedge" },
  { key: "stocks", label: "Stocks", sub: "Fertilizer, diesel & inputs" },
  { key: "timebook", label: "Time book", sub: "Weekly attendance per farm" },
  { key: "orderNumbers", label: "Order numbers", sub: "CS numbers for purchases" },
  { key: "diesel", label: "Diesel", sub: "Logbook for SARS rebates" },
  { key: "diary", label: "Diary", sub: "Reminders & recurring tasks" },
] as const;

export type SectionKey = (typeof SECTION_DEFS)[number]["key"];

export type SectionAccess = Partial<Record<Exclude<SectionKey, "timebook">, boolean>> & {
  // true = every farm's book visible, false = none, string[] = allowed farm slugs
  timebook?: boolean | string[];
};

export function hasSectionAccess(
  isAdmin: boolean,
  sectionAccess: SectionAccess | null | undefined,
  section: SectionKey
): boolean {
  if (isAdmin) return true;
  if (!sectionAccess) return true; // grandfathered — nothing restricted yet
  if (section === "timebook") {
    const v = sectionAccess.timebook;
    if (v === undefined) return false;
    if (typeof v === "boolean") return v;
    return v.length > 0; // at least one farm allowed — page itself filters which
  }
  const v = sectionAccess[section];
  return v === undefined ? false : v;
}

export function hasTimebookFarmAccess(
  isAdmin: boolean,
  sectionAccess: SectionAccess | null | undefined,
  farmSlug: string
): boolean {
  if (isAdmin) return true;
  if (!sectionAccess) return true;
  const v = sectionAccess.timebook;
  if (v === undefined) return false;
  if (typeof v === "boolean") return v;
  return v.includes(farmSlug);
}
