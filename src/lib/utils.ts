// Groups codes by their letter prefix first (plain numbers like "01".."81"
// sort before any prefix, since "" < any letter), then orders numerically
// within each group — so 07 sits with the other plain numbers instead of
// next to K7/M7/etc, and each prefix's own run (K1, K2, K3…) stays together.
export function byPaddockNumber<T extends { code: string }>(a: T, b: T) {
  const parse = (code: string) => {
    const m = code.match(/^([A-Za-z]*)(\d*)/);
    const prefix = m?.[1] ?? "";
    const num = m && m[2] ? parseInt(m[2], 10) : null;
    return { prefix, num };
  };
  const pa = parse(a.code);
  const pb = parse(b.code);
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix);
  if (pa.num == null && pb.num == null) return a.code.localeCompare(b.code);
  if (pa.num == null) return 1;
  if (pb.num == null) return -1;
  return pa.num - pb.num;
}

// Rye grass camps that actually get walked and go on the wedge — excludes
// the "GR" (Glenroy) heifer camps, which are Rye grass too but aren't
// measured. Used by both the pasture walk data-entry list and the wedge
// chart; the map and other data entry still show every paddock.
export function isMeasuredRyeGrass(p: { landType: string | null; code: string }): boolean {
  return p.landType === "Rye grass" && !p.code.toUpperCase().startsWith("GR");
}

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, "-");
}

// Local calendar date, not UTC — toISOString() converts to UTC first, which
// silently shows yesterday's (or tomorrow's) date depending on the user's
// timezone offset and time of day.
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function withinRange(dateStr: string, rangeId: string) {
  const d = new Date(dateStr);
  const today = new Date();
  if (rangeId === "all") return true;
  if (rangeId === "ytd") return d.getFullYear() === today.getFullYear();
  const cutoff = new Date(today);
  if (rangeId === "3m") cutoff.setMonth(cutoff.getMonth() - 3);
  if (rangeId === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
  if (rangeId === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);
  return d >= cutoff;
}

export function daysBetween(a: Date | string, b: Date | string) {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}
