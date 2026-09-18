import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const paddockId = searchParams.get("paddockId");
  const entries = await prisma.maizeFieldSeason.findMany({
    where: { ...(farmId ? { farmId } : {}), ...(paddockId ? { paddockId } : {}) },
    include: { paddock: { select: { code: true } } },
    orderBy: [{ paddockId: "asc" }, { season: "desc" }],
  });
  return NextResponse.json({
    entries: entries.map((e) => ({ ...e, paddockCode: e.paddock.code, paddock: undefined })),
  });
}

// Upsert by (paddockId, season) — same "logging again corrects" pattern
// used everywhere else, so a manual edit or a re-run of the auto-populate
// logic both just converge on one record per field per season.
export async function POST(req: Request) {
  const body = await req.json();
  const { farmId, paddockId, season, ...fields } = body as {
    farmId?: string;
    paddockId?: string;
    season?: string;
    variety?: string | null;
    varietyLength?: string | null;
    plantDate?: string | null;
    estMaturityDate?: string | null;
    cutDate?: string | null;
    population?: number | null;
    yieldTonPerHa?: number | null;
    firstPostSprayDate?: string | null;
    lastTractorEntryDate?: string | null;
    firstTopDressingDate?: string | null;
    secondTopDressingDate?: string | null;
    silagePit?: string | null;
    seedCostPerHa?: number | null;
    notes?: string | null;
  };
  if (!farmId || !paddockId || !season?.trim()) {
    return NextResponse.json({ error: "farmId, paddockId and season are required" }, { status: 400 });
  }
  const userId = await currentUserId();
  const data = {
    variety: fields.variety?.trim() || null,
    varietyLength: fields.varietyLength?.trim() || null,
    plantDate: fields.plantDate ? new Date(fields.plantDate) : null,
    estMaturityDate: fields.estMaturityDate ? new Date(fields.estMaturityDate) : null,
    cutDate: fields.cutDate ? new Date(fields.cutDate) : null,
    population: fields.population ?? null,
    yieldTonPerHa: fields.yieldTonPerHa ?? null,
    firstPostSprayDate: fields.firstPostSprayDate ? new Date(fields.firstPostSprayDate) : null,
    lastTractorEntryDate: fields.lastTractorEntryDate ? new Date(fields.lastTractorEntryDate) : null,
    firstTopDressingDate: fields.firstTopDressingDate ? new Date(fields.firstTopDressingDate) : null,
    secondTopDressingDate: fields.secondTopDressingDate ? new Date(fields.secondTopDressingDate) : null,
    silagePit: fields.silagePit?.trim() || null,
    seedCostPerHa: fields.seedCostPerHa ?? null,
    notes: fields.notes?.trim() || null,
    createdById: userId,
  };
  const entry = await prisma.maizeFieldSeason.upsert({
    where: { paddockId_season: { paddockId, season: season.trim() } },
    update: data,
    create: { farmId, paddockId, season: season.trim(), ...data },
  });
  return NextResponse.json({ entry });
}
