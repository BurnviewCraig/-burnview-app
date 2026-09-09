import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { date, litres, takenBy }: { date?: string; litres?: number; takenBy?: string | null } = body;
  const data: Record<string, unknown> = {};
  if (date) data.date = new Date(date);
  if (litres != null) data.litres = litres;
  if ("takenBy" in body) data.takenBy = takenBy || null;
  const entry = await prisma.milkSaleEntry.update({ where: { id }, data });
  return NextResponse.json({ entry });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.milkSaleEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
