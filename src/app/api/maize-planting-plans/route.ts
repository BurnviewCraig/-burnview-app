import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const entries = await prisma.maizePlantingPlan.findMany({
    where: farmId ? { farmId } : undefined,
    orderBy: { season: "desc" },
  });
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { farmId, season, plannedAreaHa, variety, notes }: {
    farmId?: string; season?: string; plannedAreaHa?: number | null; variety?: string | null; notes?: string | null;
  } = body;
  if (!farmId || !season?.trim()) {
    return NextResponse.json({ error: "farmId and season are required" }, { status: 400 });
  }
  const userId = await currentUserId();
  const entry = await prisma.maizePlantingPlan.create({
    data: { farmId, season: season.trim(), plannedAreaHa: plannedAreaHa ?? null, variety: variety?.trim() || null, notes: notes?.trim() || null, createdById: userId },
  });
  return NextResponse.json({ entry });
}
