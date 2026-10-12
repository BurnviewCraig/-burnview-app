import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const farmId = searchParams.get("farmId");

  if (!start || !end) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const dateFilter = { gte: new Date(start), lte: new Date(end) };

  const [activities, walks, grazing, groups, milkSales] = await Promise.all([
    prisma.fieldActivity.findMany({
      where: { date: dateFilter, ...(farmId ? { farmId } : {}) },
      include: { paddock: { select: { code: true, sizeHa: true } }, farm: { select: { name: true, slug: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.pastureWalk.findMany({
      where: { date: dateFilter, ...(farmId ? { farmId } : {}) },
      include: { paddock: { select: { code: true, sizeHa: true } }, farm: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.grazingAllocation.findMany({
      where: { date: dateFilter, ...(farmId ? { farmId } : {}) },
      include: { paddock: { select: { code: true } }, group: { select: { id: true, name: true } }, farm: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.cattleGroup.findMany({
      where: farmId ? { farmId } : undefined,
      include: { counts: { where: { date: { lte: new Date(end) } }, orderBy: { date: "desc" } } },
    }),
    prisma.milkSaleEntry.findMany({
      where: { date: dateFilter, ...(farmId ? { farmId } : {}) },
      include: { farm: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Combine day+night rows for the same group/date, and attach whatever
  // headcount was current as of that date (the most recent count on or
  // before it, since counts aren't necessarily logged every single day).
  const byGroupDate = new Map<string, typeof grazing>();
  for (const g of grazing) {
    const key = `${g.groupId}|${g.date.toISOString().slice(0, 10)}`;
    byGroupDate.set(key, [...(byGroupDate.get(key) ?? []), g]);
  }
  const countsByGroup = new Map(groups.map((g) => [g.id, g.counts]));

  const grazingSummary = [...byGroupDate.entries()].map(([key, rows]) => {
    const [groupId, date] = key.split("|");
    // A session can now hold more than one camp (a group split across two
    // camps for the same session) — every row sharing that session counts,
    // not just the first.
    const dayCodes = rows.filter((r) => r.session === "DAY").map((r) => r.paddock.code);
    const nightCodes = rows.filter((r) => r.session === "NIGHT").map((r) => r.paddock.code);
    const first = rows[0];
    const counts = countsByGroup.get(groupId) ?? [];
    const asOf = counts.find((c) => c.date.toISOString().slice(0, 10) <= date);
    return {
      groupId,
      groupName: first.group.name,
      farmName: first.farm.name,
      date,
      count: asOf?.count ?? null,
      dayPaddockCodes: dayCodes,
      nightPaddockCodes: nightCodes,
    };
  });

  return NextResponse.json({ activities, walks, grazing: grazingSummary, milkSales });
}
