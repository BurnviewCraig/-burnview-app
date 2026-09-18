import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: {
    farmId?: string; paddockId?: string; varietyId?: string | null; phase?: string | null; season?: string;
    plannedAreaHa?: number | null; population?: number | null; notes?: string | null; sortOrder?: number; ordered?: boolean;
  } = {};

  if ("paddockId" in body) {
    const paddock = await prisma.paddock.findUnique({ where: { id: body.paddockId } });
    if (!paddock) return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    data.paddockId = paddock.id;
    data.farmId = paddock.farmId;
  }
  if ("varietyId" in body) data.varietyId = body.varietyId || null;
  if ("phase" in body) data.phase = body.phase?.trim() || null;
  if ("season" in body) data.season = String(body.season).trim();
  if ("plannedAreaHa" in body) data.plannedAreaHa = body.plannedAreaHa ?? null;
  if ("population" in body) data.population = body.population ?? null;
  if ("notes" in body) data.notes = body.notes?.trim() || null;
  if ("sortOrder" in body) data.sortOrder = Number(body.sortOrder);
  if ("ordered" in body) data.ordered = !!body.ordered;

  const entry = await prisma.maizePlantingPlan.update({ where: { id }, data });
  return NextResponse.json({ entry });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.maizePlantingPlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
