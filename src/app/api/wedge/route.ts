import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { daysBetween, todayStr } from "@/lib/utils";
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
//
// ?asOf=YYYY-MM-DD (only meaningful combined with ?farmId=) replays the
// wedge as it would have looked that day — "today" throughout every
// calculation becomes asOf, and only walks/mulching/grazing on or before
// that date are considered, so an old wedge reprinted later shows exactly
// what it showed the day it was actually made, not today's numbers. The
// no-params / all-farms call (used by the overview cards) always stays
// live against the real today.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const asOf = farmId ? searchParams.get("asOf") || todayStr() : todayStr();
  const asOfDate = new Date(asOf);

  const farms = await prisma.farm.findMany({
    where: farmId ? { id: farmId } : undefined,
    orderBy: { sortOrder: "asc" },
    include: {
      paddocks: {
        include: {
          pastureWalks: { where: { date: { lte: asOfDate } }, orderBy: { date: "desc" }, take: 2 },
          // Mowing for bailing cuts the grass same as mulching does — both
          // reset a paddock's cover and count as "defoliation" for the
          // wedge, so both feed the one mulchDate/mulchDays figure below.
          fieldActivities: {
            where: { type: { in: ["MULCHING", "MOWING"] }, date: { lte: asOfDate } },
            orderBy: { date: "desc" },
            take: 1,
          },
          // Unfiltered by date — past sessions feed the DM-removed growth
          // correction and "last grazed", future ones feed the separate
          // "already on the allocation" flag below; splitting happens in
          // JS against asOfDate rather than two separate queries.
          grazingAllocations: { orderBy: { date: "desc" } },
        },
      },
      cattleGroups: {
        include: { counts: { orderBy: { date: "asc" } } },
      },
    },
  });

  const result = farms.map((farm) => {
    // date-sorted headcount history per group, so a grazing event on any
    // date can look up "the count as of then" even on a day nothing was
    // logged (carries the last known reading forward). A grazing session
    // older than the earliest count on file falls back to that earliest
    // count instead of null — the herd obviously wasn't zero cows just
    // because nobody had logged a count yet, and treating an unknown
    // headcount as 0 (rather than the closest real number) was silently
    // wiping out most of the DM-removed correction for any paddock grazed
    // before headcount tracking started, making its growth read as a sharp
    // drop instead of the normal regrowth every other paddock showed.
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
      return best ?? history[0].count;
    }

    const paddocks = farm.paddocks.map((p) => {
      const [latest, prev] = p.pastureWalks;
      const hasData = latest != null && latest.cover > 0;
      const cover = hasData ? latest.cover : null;
      // Latest mulching OR mowing-for-bailing date — either one counts as
      // defoliation (see the fieldActivities query above).
      const mulchDate = p.fieldActivities[0]?.date ?? null;

      // Past-or-asOf grazing only — a future-dated allocation is a plan,
      // not something that's actually happened yet, so it must never be
      // read as "last grazed" (that previously let an upcoming allocation
      // masquerade as history, with a negative days-since).
      const pastAllocations = p.grazingAllocations.filter((a) => a.date <= asOfDate);
      const futureAllocations = p.grazingAllocations.filter((a) => a.date > asOfDate);

      let growthPerDay: number | null = null;
      let wasDefoliated = false;
      if (hasData && prev && prev.cover > 0) {
        const days = daysBetween(prev.date, latest.date);
        if (days > 0) {
          const grazedInWindow = pastAllocations.filter((a) => a.date > prev.date && a.date <= latest.date);
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
      const mulchDays = mulchDate ? daysBetween(mulchDate, asOfDate) : null;
      const grazeDate = pastAllocations[0]?.date ?? null;
      const grazeDays = grazeDate ? daysBetween(grazeDate, asOfDate) : null;
      const daysSinceDefoliation =
        mulchDays == null ? grazeDays : grazeDays == null ? mulchDays : Math.min(mulchDays, grazeDays);
      // Already scheduled to be grazed (on the grazing allocation calendar,
      // which only ever plans a few days out) — flagged separately from
      // recentlyGrazed (grazeDays 0-7) so the wedge page can highlight both
      // "just came out of rotation" and "about to go into it" the same way.
      const upcomingAllocation = futureAllocations.length > 0;

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
        upcomingAllocation,
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
