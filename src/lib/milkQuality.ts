import type { MilkQualityEntry } from "./types";

// Clover's tank numbers are global across the business, not per-farm —
// Burnview has two bulk tanks, Everfair and Stockton one each.
export const FARM_TANKS: Record<string, number[]> = {
  burnview: [1, 2],
  everfair: [3],
  stockton: [4],
};

export const QUALITY_METRIC_FIELDS = [
  "butterfatPct",
  "proteinPct",
  "lactosePct",
  "bactoscanCountPerMl",
  "somaticCellCountPerMl",
  "munMgPer100ml",
  "alizarolPct",
] as const;
export type QualityMetricField = (typeof QUALITY_METRIC_FIELDS)[number];

export type FarmQualityRow = { date: string } & Record<QualityMetricField, number | null>;

function average(values: number[]) {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Combines the given tanks' readings into one per-date series. When more
// than one tank has a reading for the same date (Burnview's two tanks),
// they're combined weighted by that day's litres rather than a plain
// average, since the two tanks can carry very different volumes.
export function aggregateFarmQuality(entries: MilkQualityEntry[], tanks: number[]): FarmQualityRow[] {
  const byDate = new Map<string, Partial<Record<QualityMetricField, { value: number; litres: number | null }[]>>>();

  for (const e of entries) {
    if (!tanks.includes(e.tankNumber)) continue;
    const date = e.date.slice(0, 10);
    const row = byDate.get(date) ?? {};
    for (const field of QUALITY_METRIC_FIELDS) {
      const v = e[field];
      if (v == null) continue;
      const list = row[field] ?? [];
      list.push({ value: v, litres: e.litres ?? null });
      row[field] = list;
    }
    byDate.set(date, row);
  }

  const rows: FarmQualityRow[] = [];
  for (const [date, values] of byDate.entries()) {
    const row = { date } as FarmQualityRow;
    for (const field of QUALITY_METRIC_FIELDS) {
      const list = values[field];
      if (!list || list.length === 0) { row[field] = null; continue; }
      const weighted = list.filter((v) => v.litres != null && v.litres > 0);
      if (weighted.length > 0) {
        const totalLitres = weighted.reduce((s, v) => s + (v.litres as number), 0);
        row[field] = totalLitres > 0
          ? weighted.reduce((s, v) => s + v.value * (v.litres as number), 0) / totalLitres
          : average(list.map((v) => v.value));
      } else {
        row[field] = average(list.map((v) => v.value));
      }
    }
    rows.push(row);
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function latestQualityValue(rows: FarmQualityRow[], field: QualityMetricField) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i][field];
    if (v != null) return { value: v, date: rows[i].date };
  }
  return null;
}
