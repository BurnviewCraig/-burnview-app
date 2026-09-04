import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { daysBetween } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Computes real wedge figures from actual pasture-walk data — no synthetic
// per-paddock covers. A paddock with no walk yet shows as "no data" rather
// than a guessed number. Growth is a simple (latest - previous) / days
// estimate between a paddock's two most recent walks; it doesn't account for
// grazing/defoliation since herd movements aren't tracked yet (Cattle isn't
// built), so treat it as directional, not precise DM production.
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
        },
      },
    },
  });

  const now = new Date();

  const result = farms.map((farm) => {
    const paddocks = farm.paddocks.map((p) => {
      const [latest, prev] = p.pastureWalks;
      const cover = latest ? latest.cover : null;
      const hasData = latest != null;
      let growthPerDay: number | null = null;
      if (latest && prev) {
        const days = daysBetween(prev.date, latest.date);
        if (days > 0) growthPerDay = (latest.cover - prev.cover) / days;
      }
      const mulchDate = p.fieldActivities[0]?.date ?? null;
      const mulchDays = mulchDate ? daysBetween(mulchDate, now) : null;
      return {
        id: p.id,
        code: p.code,
        landType: p.landType,
        sizeHa: p.sizeHa,
        cover,
        hasData,
        growthPerDay,
        mulchDays,
        walkDate: latest ? latest.date.toISOString().slice(0, 10) : null,
        boundary: p.boundary,
      };
    });

    const withData = paddocks.filter((p) => p.hasData);
    const avgCover = withData.length
      ? Math.round(withData.reduce((s, p) => s + (p.cover ?? 0), 0) / withData.length)
      : null;
    const withGrowth = paddocks.filter((p) => p.growthPerDay != null);
    const avgGrowth = withGrowth.length
      ? Math.round((withGrowth.reduce((s, p) => s + (p.growthPerDay ?? 0), 0) / withGrowth.length) * 10) / 10
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
