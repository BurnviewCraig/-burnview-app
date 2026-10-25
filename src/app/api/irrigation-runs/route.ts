import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// Returns runs in the given date range, plus — per pivot — any grazing
// allocation in that same range sitting on one of the pivot's camps. A
// pivot's circle eventually covers every camp it owns in one pass, so any
// camp of its grazed during the scheduled week is worth flagging; this is
// a visible warning only (the decision to run anyway is the farmer's), not
// a block on saving.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const [pivots, runs, allocations] = await Promise.all([
    prisma.pivot.findMany({ select: { id: true, farmId: true, paddockCodes: true } }),
    prisma.irrigationRun.findMany({
      where: { date: { gte: new Date(start), lte: new Date(end) } },
      orderBy: { date: "asc" },
      include: { startPaddock: { select: { id: true, code: true } } },
    }),
    prisma.grazingAllocation.findMany({
      where: { date: { gte: new Date(start), lte: new Date(end) } },
      include: { paddock: { select: { code: true } }, group: { select: { name: true } } },
    }),
  ]);

  const conflicts: Record<string, { paddockCode: string; groupName: string; date: string }[]> = {};
  for (const pivot of pivots) {
    const codes = new Set(pivot.paddockCodes);
    const hits = allocations
      .filter((a) => a.farmId === pivot.farmId && codes.has(a.paddock.code))
      .map((a) => ({ paddockCode: a.paddock.code, groupName: a.group.name, date: a.date.toISOString().slice(0, 10) }));
    if (hits.length) conflicts[pivot.id] = hits;
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
