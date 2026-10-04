import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { daysBetween, isMeasuredRyeGrass } from "@/lib/utils";
import { correctedGrowthPerDay } from "@/lib/growthCalc";

export const dynamic = "force-dynamic";

// Camp growth comparison — same corrected-growth math as the wedge (raw
// cover delta understates growth on anything grazed in between, since the
// herd removed DM that did grow; see lib/growthCalc.ts), but spanning a
// chosen date range's first and last walk instead of only the latest two.
// That's mathematically the same as chaining the per-interval corrected
// rates across every walk in between — the DM-removed corrections are
// additive over the whole span — so one pass using the range's endpoints
// is enough, no need to walk interval-by-interval.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const paddocks = await prisma.paddock.findMany({
    where: {
      ...(farmId && farmId !== "all" ? { farmId } : {}),
      landType: "Rye grass",
    },
    include: {
      farm: { select: { name: true } },
      pastureWalks: { where: { date: { gte: fromDate, lte: toDate } }, orderBy: { date: "asc" } },
      grazingAllocations: { where: { date: { gte: fromDate, lte: toDate } } },
    },
  });
  const rye = paddocks.filter(isMeasuredRyeGrass);

  // Headcount-as-of, same fallback as the wedge: a grazing session older
  // than the earliest logged count still uses that earliest count rather
  // than treating the herd as 0 cows.
  const farmIds = [...new Set(rye.map((p) => p.farmId))];
  const groups = await prisma.cattleGroup.findMany({
    where: { farmId: { in: farmIds } },
    include: { counts: { orderBy: { date: "asc" } } },
  });
  const countHistory = new Map(groups.map((g) => [g.id, g.counts]));
  function headcountAsOf(groupId: string, date: Date): number | null {
    const history = countHistory.get(groupId);
    if (!history?.length) return null;
    let best: number | null = null;
    for (const c of history) {
      if (c.date > date) break;
      best = c.count;
    }
    return best ?? history[0].count;
  }

  const rows = rye.map((p) => {
    const walks = p.pastureWalks.filter((w) => w.cover > 0);
    const first = walks[0] ?? null;
    const last = walks.length > 1 ? walks[walks.length - 1] : null;

    let avgGrowth: number | null = null;
    if (first && last) {
      const days = daysBetween(first.date, last.date);
      if (days > 0) {
        if (p.sizeHa) {
          const sessionsGrazed = p.grazingAllocations
            .filter((a) => a.date > first.date && a.date <= last.date)
            .map((a) => ({ headcount: headcountAsOf(a.groupId, a.date) ?? 0 }));
          avgGrowth = correctedGrowthPerDay({ coverNow: last.cover, coverPrevious: first.cover, days, sizeHa: p.sizeHa, sessionsGrazed });
        } else {
          avgGrowth = (last.cover - first.cover) / days;
        }
      }
    }

    return {
      paddockId: p.id,
      code: p.code,
      farmName: p.farm.name,
      sizeHa: p.sizeHa,
      walkCount: walks.length,
      avgGrowth: avgGrowth != null ? Math.round(avgGrowth * 10) / 10 : null,
      startCover: first?.cover ?? null,
      endCover: last?.cover ?? null,
      firstWalkDate: first ? first.date.toISOString().slice(0, 10) : null,
      lastWalkDate: last ? last.date.toISOString().slice(0, 10) : null,
    };
  });

  rows.sort((a, b) => (b.avgGrowth ?? -Infinity) - (a.avgGrowth ?? -Infinity));

  // Area-weighted, same reasoning as the wedge's farm-wide figure — a
  // bigger paddock represents more of the farm's actual DM growth. This is
  // what "performing vs not" gets measured against on the frontend.
  const withGrowth = rows.filter((r) => r.avgGrowth != null && r.sizeHa);
  const growthArea = withGrowth.reduce((s, r) => s + (r.sizeHa ?? 0), 0);
  const avgGrowth = growthArea
    ? Math.round((withGrowth.reduce((s, r) => s + (r.avgGrowth ?? 0) * (r.sizeHa ?? 0), 0) / growthArea) * 10) / 10
    : null;

  return NextResponse.json({ rows, avgGrowth, from, to });
}
