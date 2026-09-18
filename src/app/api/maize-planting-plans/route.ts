import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// No farmId filter by default — planting jumps around between farms, so
// this is one global, farm-agnostic list ordered by sortOrder (the order
// the user actually plans to plant in), not grouped per farm. Variety is
// included so cost/ha, maturity length and bags-needed can be worked out
// client-side from its current pricing.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const entries = await prisma.maizePlantingPlan.findMany({
    where: farmId ? { farmId } : undefined,
    include: { paddock: { select: { code: true } }, farm: { select: { name: true } }, variety: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({
    entries: entries.map((e) => ({ ...e, paddockCode: e.paddock.code, farmName: e.farm.name, paddock: undefined, farm: undefined })),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { paddockId, varietyId, phase, season, plannedAreaHa, population, notes } = body as {
    paddockId?: string; varietyId?: string | null; phase?: string | null; season?: string;
    plannedAreaHa?: number | null; population?: number | null; notes?: string | null;
  };
  if (!paddockId || !season?.trim()) {
    return NextResponse.json({ error: "paddockId and season are required" }, { status: 400 });
  }
  const paddock = await prisma.paddock.findUnique({ where: { id: paddockId } });
  if (!paddock) return NextResponse.json({ error: "Camp not found" }, { status: 404 });

  const userId = await currentUserId();
  const last = await prisma.maizePlantingPlan.findFirst({ orderBy: { sortOrder: "desc" } });
  const entry = await prisma.maizePlantingPlan.create({
    data: {
      farmId: paddock.farmId,
      paddockId,
      varietyId: varietyId || null,
      phase: phase?.trim() || null,
      season: season.trim(),
      plannedAreaHa: plannedAreaHa ?? null,
      population: population ?? null,
      notes: notes?.trim() || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      createdById: userId,
    },
  });
  return NextResponse.json({ entry });
}
