import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { season?: string; plannedAreaHa?: number | null; variety?: string | null; notes?: string | null } = {};
  if ("season" in body) data.season = String(body.season).trim();
  if ("plannedAreaHa" in body) data.plannedAreaHa = body.plannedAreaHa ?? null;
  if ("variety" in body) data.variety = body.variety?.trim() || null;
  if ("notes" in body) data.notes = body.notes?.trim() || null;

  const entry = await prisma.maizePlantingPlan.update({ where: { id }, data });
  return NextResponse.json({ entry });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.maizePlantingPlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
