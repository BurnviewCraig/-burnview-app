import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns runs in the given date range, plus — per run — the real camps
// that run's sweep will reach while cows are still grazing them. paddockCodes
// is the pivot's physical sweep order (camps were already numbered that way
// on the ground), so starting from the run's chosen start camp and walking
// that list in a circular loop gives, for every camp, how many revolutions-
// worth of arc away it is; scaling that by how long a full revolution takes
// at this run's speed gives hours-to-reach, and flooring to whole days
// (runs are scheduled by day, not time of day) gives the calendar date the
// pivot is actually over that camp. A run whose pivot has no hoursAt100Pct
// rating yet, or has no start camp chosen, can't be placed on a day this
// way, so it's just left out of the conflict check (no false confidence).
// This is a visible warning only — the decision to run anyway is the
// farmer's, not a block on saving.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const [pivots, runs] = await Promise.all([
    prisma.pivot.findMany({ select: { id: true, farmId: true, paddockCodes: true, hoursAt100Pct: true } }),
    prisma.irrigationRun.findMany({
      where: { date: { gte: new Date(start), lte: new Date(end) } },
      orderBy: { date: "asc" },
      include: { startPaddock: { select: { id: true, code: true } } },
    }),
  ]);
  const pivotById = new Map(pivots.map((p) => [p.id, p]));

  type Arrival = { runId: string; farmId: string; paddockCode: string; date: string };
  const arrivals: Arrival[] = [];
  let maxArrival = end;
  for (const run of runs) {
    const pivot = pivotById.get(run.pivotId);
    if (!pivot || pivot.hoursAt100Pct == null || !run.startPaddock) continue;
    const startIndex = pivot.paddockCodes.indexOf(run.startPaddock.code);
    if (startIndex === -1) continue;
    const totalCamps = pivot.paddockCodes.length;
    const hoursAtSpeed = (pivot.hoursAt100Pct * 100) / run.percentage;
    const runDateIso = run.date.toISOString().slice(0, 10);
    for (let i = 0; i < totalCamps; i++) {
      const offset = (i - startIndex + totalCamps) % totalCamps;
      const hoursToReach = (offset / totalCamps) * hoursAtSpeed;
      const arrivalDate = addDaysIso(runDateIso, Math.floor(hoursToReach / 24));
      arrivals.push({ runId: run.id, farmId: pivot.farmId, paddockCode: pivot.paddockCodes[i], date: arrivalDate });
      if (arrivalDate > maxArrival) maxArrival = arrivalDate;
    }
  }

  const allocations = arrivals.length
    ? await prisma.grazingAllocation.findMany({
        where: { date: { gte: new Date(start), lte: new Date(maxArrival) } },
        include: { paddock: { select: { code: true } }, group: { select: { name: true } } },
      })
    : [];
  const allocByKey = new Map<string, string[]>();
  for (const a of allocations) {
    const key = `${a.farmId}|${a.paddock.code}|${a.date.toISOString().slice(0, 10)}`;
    allocByKey.set(key, [...(allocByKey.get(key) ?? []), a.group.name]);
  }

  const conflicts: Record<string, { paddockCode: string; groupName: string; date: string }[]> = {};
  for (const row of arrivals) {
    const groupNames = allocByKey.get(`${row.farmId}|${row.paddockCode}|${row.date}`);
    if (!groupNames) continue;
    const list = (conflicts[row.runId] ??= []);
    for (const groupName of [...new Set(groupNames)]) list.push({ paddockCode: row.paddockCode, groupName, date: row.date });
  }

  return NextResponse.json({ runs, conflicts });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const pivotId = (body as { pivotId?: string }).pivotId;
  const date = (body as { date?: string }).date;
  const percentage = Number((body as { percentage?: number }).percentage);
  if (!pivotId || !date || !Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
    return NextResponse.json({ error: "pivotId, date and a percentage (1-100) are required" }, { status: 400 });
  }
  const startPaddockId = (body as { startPaddockId?: string }).startPaddockId || null;
  const notes = (body as { notes?: string }).notes?.trim() || null;

  const userId = await currentUserId();
  const run = await prisma.irrigationRun.create({
    data: { pivotId, date: new Date(date), percentage: Math.round(percentage), startPaddockId, notes, createdById: userId },
    include: { startPaddock: { select: { id: true, code: true } } },
  });
  return NextResponse.json({ run });
}
