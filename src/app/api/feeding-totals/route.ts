import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Per-farm daily meal totals, for ordering — "meal" here is exactly what
// the Feeding page already tracks per group: the AFI dairy meal (kg/cow)
// plus any additional concentrates (kg/cow), times the group's latest
// headcount. Deliberately leaves out silage and the free-text "other
// concentrate" logged per day on the cattle group history — those aren't
// shown on the Feeding page and aren't ordered the same way meal is.
export async function GET() {
  const farms = await prisma.farm.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      cattleGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          counts: { orderBy: { date: "desc" }, take: 1 },
          feedEntries: { orderBy: { date: "desc" }, take: 1 },
          additionalConcentrates: true,
        },
      },
    },
  });

  const result = farms
    .map((farm) => {
      const groups = farm.cattleGroups
        .map((g) => {
          const currentCount = g.counts[0]?.count ?? null;
          const dairyMealKg = g.feedEntries[0]?.dairyMealKg ?? null;
          const concentratesKg = g.additionalConcentrates.reduce((s, c) => s + c.kgPerCow, 0);
          const kgPerCow = (dairyMealKg ?? 0) + concentratesKg;
          const kgPerDay = currentCount != null ? Math.round(kgPerCow * currentCount) : null;
          return {
            groupId: g.id,
            groupName: g.name,
            currentCount,
            dairyMealKg,
            concentratesKg: concentratesKg || null,
            kgPerCow: kgPerCow || null,
            kgPerDay,
          };
        })
        .filter((g) => g.kgPerDay != null);
      const totalKgPerDay = groups.reduce((s, g) => s + (g.kgPerDay ?? 0), 0);
      return { farmId: farm.id, farmName: farm.name, totalKgPerDay, groups };
    })
    .filter((f) => f.groups.length > 0);

  return NextResponse.json({ farms: result });
}
