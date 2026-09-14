import type { DieselLogEntry } from "@/lib/types";

export type DieselComputed = {
  closing: number | null;
  hours: number | null;
  litresUsed: number | null;
  rate: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Fuel isn't necessarily filled every day, so a fill on day F pays for
// every WORKED day since the previous fill (not just yesterday) —
// prorated by each of those days' own share of hours/km worked, with one
// averaged rate across the whole stretch. Pass an asset's FULL entry
// history (not just a date window) so a fill just outside a print/view
// range still prorates correctly into days inside it.
export function computeDieselByDate(entries: DieselLogEntry[], unit: "HOURS" | "KM"): Map<string, DieselComputed> {
  const worked = entries
    .filter((e) => e.worked && e.openingReading != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const computed = new Map<string, DieselComputed>();
  worked.forEach((e, i) => {
    const next = worked[i + 1];
    const closing = next?.openingReading ?? null;
    const hours = closing != null && e.openingReading != null ? round1(closing - e.openingReading) : null;
    computed.set(e.date, { closing, hours, litresUsed: null, rate: null });
  });

  let segmentStart = 0;
  worked.forEach((e, i) => {
    if (e.litresFilled == null) return;
    const start = worked[segmentStart];
    const usageTotal = start.openingReading != null && e.openingReading != null ? e.openingReading - start.openingReading : null;
    if (usageTotal != null && usageTotal > 0) {
      const rate = unit === "KM" ? round2(usageTotal / e.litresFilled) : round2(e.litresFilled / usageTotal);
      for (let j = segmentStart; j < i; j++) {
        const dj = worked[j];
        const c = computed.get(dj.date);
        if (c && c.hours != null) {
          c.litresUsed = round1(e.litresFilled * (c.hours / usageTotal));
          c.rate = rate;
        }
      }
    }
    segmentStart = i;
  });

  return computed;
}
