import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DATE_FIELDS = ["plantDate", "estMaturityDate", "cutDate", "firstPostSprayDate", "lastTractorEntryDate", "firstTopDressingDate", "secondTopDressingDate"];
const STRING_FIELDS = ["variety", "varietyLength", "silagePit", "notes"];
const NUMBER_FIELDS = ["population", "yieldTonPerHa", "seedCostPerHa"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of DATE_FIELDS) if (key in body) data[key] = body[key] ? new Date(body[key]) : null;
  for (const key of STRING_FIELDS) if (key in body) data[key] = body[key]?.trim?.() || null;
  for (const key of NUMBER_FIELDS) if (key in body) data[key] = body[key] ?? null;
  if ("season" in body) data.season = String(body.season).trim();

  const entry = await prisma.maizeFieldSeason.update({ where: { id }, data });
  return NextResponse.json({ entry });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.maizeFieldSeason.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
