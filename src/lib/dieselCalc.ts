import type { DieselLogEntry } from "@/lib/types";

export type DieselComputed = {
  closing: number | null;
  hours: number | null;
  litresUsed: number | null;
  rate: number | null;
};

type Checkpoint = { date: string; reading: number; litresFilled: number | null };

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Fuel isn't necessarily filled every day, so a fill on checkpoint F pays
// for every checkpoint's own reading-delta since the previous fill closed
// out (not just yesterday) — prorated by each checkpoint's own share, with
// one averaged rate across the whole stretch. A heavy-work day can have a
// second, same-day fill (secondReading/secondLitresFilled) — that's just
// a second checkpoint slotted in between the day's own opening and the
// next worked day's opening, so it prorates correctly either side of it;
// litresUsed/rate for that date are the sum of both its checkpoints'
// shares. Pass an asset's FULL entry history (not just a date window) so
// a fill just outside a print/view range still prorates correctly into
// days inside it.
export function computeDieselByDate(entries: DieselLogEntry[], unit: "HOURS" | "KM"): Map<string, DieselComputed> {
  const workedEntries = entries
    .filter((e) => e.worked && e.openingReading != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const checkpoints: Checkpoint[] = [];
  for (const e of workedEntries) {
    checkpoints.push({ date: e.date, reading: e.openingReading!, litresFilled: e.litresFilled ?? null });
    if (e.secondReading != null) {
      checkpoints.push({ date: e.date, reading: e.secondReading, litresFilled: e.secondLitresFilled ?? null });
    }
  }

  const computed = new Map<string, DieselComputed>();
  workedEntries.forEach((e) => computed.set(e.date, { closing: null, hours: null, litresUsed: null, rate: null }));

  // Closing/hours is per calendar day, independent of any second same-day
  // checkpoint — the day's own opening to the next WORKED day's opening.
  workedEntries.forEach((e, i) => {
    const next = workedEntries[i + 1];
    const closing = next?.openingReading ?? null;
    const hours = closing != null && e.openingReading != null ? round1(closing - e.openingReading) : null;
    const c = computed.get(e.date)!;
    c.closing = closing;
    c.hours = hours;
  });

  // Distribute each fill's litres back across every checkpoint since the
  // last one that closed a segment, weighted by that checkpoint's own
  // reading-delta to the NEXT checkpoint (same day or not) — then sum onto
  // whichever date each checkpoint belongs to.
  const dateLitres = new Map<string, number>();
  let segmentStart = 0;
  checkpoints.forEach((cp, i) => {
    if (cp.litresFilled == null) return;
    const usageTotal = cp.reading - checkpoints[segmentStart].reading;
    if (usageTotal > 0) {
      for (let j = segmentStart; j < i; j++) {
        const intervalHours = checkpoints[j + 1].reading - checkpoints[j].reading;
        const share = cp.litresFilled * (intervalHours / usageTotal);
        dateLitres.set(checkpoints[j].date, (dateLitres.get(checkpoints[j].date) ?? 0) + share);
      }
    }
    segmentStart = i;
  });

  dateLitres.forEach((litres, date) => {
    const c = computed.get(date);
    if (!c || c.hours == null || c.hours <= 0 || litres <= 0) return;
    c.litresUsed = round1(litres);
    c.rate = unit === "KM" ? round2(c.hours / litres) : round2(litres / c.hours);
  });

  return computed;
}
