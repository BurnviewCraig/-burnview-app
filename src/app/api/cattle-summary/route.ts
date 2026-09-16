import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gramsPerLitre } from "@/lib/feedCalc";

export const dynamic = "force-dynamic";

type Point = { date: string; value: number };

// Farm-wide (farmId given) or business-wide (no farmId) averages, weighted
// by each group's headcount so a big group doesn't get the same say as a
// small one. Computed on read from the same daily group entries the AFI
// import and manual logging both write to — nothing extra is stored here.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");

  const groups = await prisma.cattleGroup.findMany({
    where: farmId ? { farmId } : undefined,
    select: { id: true },
  });
  const groupIds = groups.map((g) => g.id);

  const empty = { current: null, trend: { litres: [], weight: [], dairyMeal: [], gramsPerLitre: [], count: [], daysInMilk: [] } };
  if (groupIds.length === 0) return NextResponse.json(empty);

  const [counts, milk, weights, feed, dim] = await Promise.all([
    prisma.cattleCountEntry.findMany({ where: { groupId: { in: groupIds } } }),
    prisma.milkProductionEntry.findMany({ where: { groupId: { in: groupIds } } }),
    prisma.groupWeightEntry.findMany({ where: { groupId: { in: groupIds } } }),
    prisma.groupFeedEntry.findMany({ where: { groupId: { in: groupIds }, dairyMealKg: { not: null } } }),
    prisma.groupDimEntry.findMany({ where: { groupId: { in: groupIds } } }),
  ]);

  function byDateGroup<T extends { date: Date; groupId: string }>(rows: T[]) {
    const m = new Map<string, Map<string, T>>();
    for (const r of rows) {
      const d = r.date.toISOString().slice(0, 10);
      if (!m.has(d)) m.set(d, new Map());
      m.get(d)!.set(r.groupId, r);
    }
    return m;
  }

  const countsByDate = byDateGroup(counts);
  const milkByDate = byDateGroup(milk);
  const weightByDate = byDateGroup(weights);
  const feedByDate = byDateGroup(feed);
  const dimByDate = byDateGroup(dim);

  const allDates = new Set<string>([
    ...countsByDate.keys(),
    ...milkByDate.keys(),
    ...weightByDate.keys(),
    ...feedByDate.keys(),
    ...dimByDate.keys(),
  ]);

  const countPoints: Point[] = [];
  const litresPoints: Point[] = [];
  const weightPoints: Point[] = [];
  const dairyMealPoints: Point[] = [];
  const gplPoints: Point[] = [];
  const dimPoints: Point[] = [];

  for (const date of Array.from(allDates).sort()) {
    const dayCounts = countsByDate.get(date);
    const dayMilk = milkByDate.get(date);
    const dayWeight = weightByDate.get(date);
    const dayFeed = feedByDate.get(date);
    const dayDim = dimByDate.get(date);

    let totalCount = 0;
    let milkWeighted = 0, milkWeight = 0;
    let weightWeighted = 0, weightWeight = 0;
    let feedWeighted = 0, feedWeight = 0;
    let dimWeighted = 0, dimWeight = 0;

    for (const groupId of groupIds) {
      const c = dayCounts?.get(groupId)?.count;
      if (c == null) continue;
      totalCount += c;

      const m = dayMilk?.get(groupId)?.litresPerCow;
      if (m != null) { milkWeighted += m * c; milkWeight += c; }

      const w = dayWeight?.get(groupId)?.avgWeightKg;
      if (w != null) { weightWeighted += w * c; weightWeight += c; }

      const f = dayFeed?.get(groupId)?.dairyMealKg;
      if (f != null) { feedWeighted += f * c; feedWeight += c; }

      const dm = dayDim?.get(groupId)?.avgDaysInMilk;
      if (dm != null) { dimWeighted += dm * c; dimWeight += c; }
    }

    if (totalCount > 0) countPoints.push({ date, value: totalCount });

    let avgMilk: number | null = null;
    if (milkWeight > 0) {
      avgMilk = Math.round((milkWeighted / milkWeight) * 10) / 10;
      litresPoints.push({ date, value: avgMilk });
    }
    if (weightWeight > 0) weightPoints.push({ date, value: Math.round((weightWeighted / weightWeight) * 10) / 10 });
    if (dimWeight > 0) dimPoints.push({ date, value: Math.round((dimWeighted / dimWeight) * 10) / 10 });

    let avgFeed: number | null = null;
    if (feedWeight > 0) {
      avgFeed = Math.round((feedWeighted / feedWeight) * 10) / 10;
      dairyMealPoints.push({ date, value: avgFeed });
    }

    const gpl = gramsPerLitre(avgFeed, avgMilk);
    if (gpl != null) gplPoints.push({ date, value: gpl });
  }

  const last = (arr: Point[]) => (arr.length ? arr[arr.length - 1].value : null);

  return NextResponse.json({
    current: {
      count: last(countPoints),
      litresPerCow: last(litresPoints),
      avgWeightKg: last(weightPoints),
      dairyMealKg: last(dairyMealPoints),
      gramsPerLitre: last(gplPoints),
      avgDaysInMilk: last(dimPoints),
    },
    trend: {
      litres: litresPoints,
      weight: weightPoints,
      dairyMeal: dairyMealPoints,
      gramsPerLitre: gplPoints,
      count: countPoints,
      daysInMilk: dimPoints,
    },
  });
}
