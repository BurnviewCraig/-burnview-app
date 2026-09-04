import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const groupId = searchParams.get("groupId");
  const paddockId = searchParams.get("paddockId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const allocations = await prisma.grazingAllocation.findMany({
    where: {
      ...(farmId ? { farmId } : {}),
      ...(groupId ? { groupId } : {}),
      ...(paddockId ? { paddockId } : {}),
      ...(start && end ? { date: { gte: new Date(start), lte: new Date(end) } } : {}),
    },
    include: { paddock: { select: { code: true } }, group: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  // Attach the headcount that was current as of each allocation's date (the
  // most recent count on or before it), so callers don't need a second
  // round trip to show "Group (N)" for history.
  const groupIds = [...new Set(allocations.map((a) => a.groupId))];
  const countsByGroup = new Map(
    await Promise.all(
      groupIds.map(async (id) => {
        const counts = await prisma.cattleCountEntry.findMany({ where: { groupId: id }, orderBy: { date: "desc" } });
        return [id, counts] as const;
      })
    )
  );
  const withCount = allocations.map((a) => {
    const dateKey = a.date.toISOString().slice(0, 10);
    const counts = countsByGroup.get(a.groupId) ?? [];
    const asOf = counts.find((c) => c.date.toISOString().slice(0, 10) <= dateKey);
    return { ...a, count: asOf?.count ?? null };
  });

  return NextResponse.json({ allocations: withCount });
}

// Upsert one or both sessions (day/night) for a group on a date. Each
// session is independent — a group can have just a day allocation, just a
// night one, or both, and re-posting the same group/date/session corrects
// that entry rather than duplicating it.
export async function POST(req: Request) {
  const body = await req.json();
  const {
    groupId,
    farmId,
    date,
    notes,
    sessions,
  }: {
    groupId: string;
    farmId: string;
    date: string;
    notes?: string;
    sessions: { session: "DAY" | "NIGHT"; paddockId: string }[];
  } = body;

  if (!groupId || !farmId || !date || !sessions?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userId = await currentUserId();

  const saved = await prisma.$transaction(
    sessions.map((s) =>
      prisma.grazingAllocation.upsert({
        where: { groupId_date_session: { groupId, date: new Date(date), session: s.session } },
        update: { paddockId: s.paddockId, notes: notes || null, createdById: userId },
        create: { groupId, farmId, paddockId: s.paddockId, date: new Date(date), session: s.session, notes: notes || null, createdById: userId },
      })
    )
  );

  return NextResponse.json({ allocations: saved });
}
