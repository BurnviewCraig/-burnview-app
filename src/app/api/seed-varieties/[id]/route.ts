import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Editing cost/seeds-per-bag/maturity only affects future plantings —
// MaizeFieldSeason snapshots the computed cost and maturity date at
// planting time rather than looking this up live, so past fields are
// never rewritten by a price change here.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { costPerBag?: number | null; seedsPerBag?: number | null; daysToMaturity?: number | null } = {};
  if ("costPerBag" in body) data.costPerBag = body.costPerBag ?? null;
  if ("seedsPerBag" in body) data.seedsPerBag = body.seedsPerBag ?? null;
  if ("daysToMaturity" in body) data.daysToMaturity = body.daysToMaturity ?? null;

  const variety = await prisma.seedVariety.update({ where: { id }, data });
  return NextResponse.json({ variety });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.seedVariety.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
