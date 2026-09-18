import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { daysBetween } from "@/lib/utils";
import { correctedGrowthPerDay } from "@/lib/growthCalc";

export const dynamic = "force-dynamic";

// Returns every paddock (any land type) with boundary + latest walk/mulch
// info, and farm-level paddockCount/noDataCount/avgCover/avgGrowth summed
// across ALL of them — this feeds the farm map as well as the wedge, so
// nothing here is scoped down to one land type (the wedge page itself
// narrows to Rye grass client-side; see food/wedge/page.tsx).
//
// Growth is worked out the way a proper grazing wedge does it: raw cover
// delta between a paddock's two most recent walks understates growth on
// anything grazed in between, since the herd removed dry matter that did
// grow — that DM is added back using the paddock's actual grazing history
// and the group's headcount at the time (see lib/growthCalc.ts). Paddocks
// missing an area (sizeHa) fall back to the raw delta, since DM removed
// can't be expressed per hectare without one.
//
// A cover of 0 means "not walked" rather than a real reading. That paddock
// still gets a spot on the wedge (as a flagged no-data bar, same as a
// paddock that's never been walked at all) — it just doesn't count toward
// avgCover/avgGrowth, and growth isn't computed off of it.
export async function GET() {
  const farms = await prisma.farm.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      paddocks: {
        include: {
          pastureWalks: { orderBy: { date: "desc" }, take: 2 },
          fieldActivities: {
            where: { type: "MULCHING" },
            orderBy: { date: "desc" },
            take: 1,
          },
          grazingAllocations: { orderBy: { date: "desc" } },
        },
      },
      cattleGroups: {
        include: { counts: { orderBy: { date: "asc" } } },
      },
    },
  });

  const now = new Date();

  const result = farms.map((farm) => {
    // date-sorted headcount history per group, so a grazing event on any
    // date can look up "the count as of then" even on a day nothing was
    // logged (carries the last known reading forward).
    const countHistory = new Map(
      farm.cattleGroups.map((g) => [g.id, g.counts])
    );
    function headcountAsOf(groupId: string, date: Date): number | null {
      const history = countHistory.get(groupId);
      if (!history?.length) return null;
      let best: number | null = null;
      for (const c of history) {
        if (c.date > date) break;
        best = c.count;
      }
      return best;
    }

    const paddocks = farm.paddocks.map((p) => {
      const [latest, prev] = p.pastureWalks;
      const hasData = latest != null && latest.cover > 0;
      const cover = hasData ? latest.cover : null;
      const mulchDate = p.fieldActivities[0]?.date ?? null;
      let growthPerDay: number | null = null;
      let wasDefoliated = false;
      if (hasData && prev && prev.cover > 0) {
        const days = daysBetween(prev.date, latest.date);
        if (days > 0) {
          const grazedInWindow = p.grazingAllocations.filter((a) => a.date > prev.date && a.date <= latest.date);
          const mulchedInWindow = mulchDate != null && mulchDate > prev.date && mulchDate <= latest.date;
          wasDefoliated = grazedInWindow.length > 0 || mulchedInWindow;
          if (p.sizeHa) {
            const sessionsGrazed = grazedInWindow.map((a) => ({ headcount: headcountAsOf(a.groupId, a.date) ?? 0 }));
            growthPerDay = correctedGrowthPerDay({
              coverNow: latest.cover,
              coverPrevious: prev.cover,
              days,
              sizeHa: p.sizeHa,
              sessionsGrazed,
            });
          } else {
            growthPerDay = (latest.cover - prev.cover) / days;
          }
        }
      }
      const mulchDays = mulchDate ? daysBetween(mulchDate, now) : null;
      const grazeDate = p.grazingAllocations[0]?.date ?? null;
      const grazeDays = grazeDate ? daysBetween(grazeDate, now) : null;
      const daysSinceDefoliation =
        mulchDays == null ? grazeDays : grazeDays == null ? mulchDays : Math.min(mulchDays, grazeDays);
      return {
        id: p.id,
        code: p.code,
        landType: p.landType,
        sizeHa: p.sizeHa,
        cover,
        prevCover: prev && prev.cover > 0 ? prev.cover : null,
        wasDefoliated,
        hasData,
        growthPerDay: growthPerDay != null ? Math.round(growthPerDay * 10) / 10 : null,
        mulchDays,
        grazeDays,
        daysSinceDefoliation,
        walkDate: latest ? latest.date.toISOString().slice(0, 10) : null,
        boundary: p.boundary,
      };
    });

    const withData = paddocks.filter((p) => p.hasData);
    const avgCover = withData.length
      ? Math.round(withData.reduce((s, p) => s + (p.cover ?? 0), 0) / withData.length)
      : null;
    // Area-weighted — a paddock twice the size contributes twice the total
    // dry matter, so it should count twice as much toward the farm average.
    const withGrowth = paddocks.filter((p) => p.growthPerDay != null && p.sizeHa);
    const growthArea = withGrowth.reduce((s, p) => s + (p.sizeHa ?? 0), 0);
    const avgGrowth = growthArea
      ? Math.round((withGrowth.reduce((s, p) => s + (p.growthPerDay ?? 0) * (p.sizeHa ?? 0), 0) / growthArea) * 10) / 10
      : null;

    return {
      id: farm.id,
      slug: farm.slug,
      name: farm.name,
      paddockCount: paddocks.length,
      noDataCount: paddocks.length - withData.length,
      avgCover,
      avgGrowth,
      paddocks,
    };
  });

  return NextResponse.json({ farms: result });
}
