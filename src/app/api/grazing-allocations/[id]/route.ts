import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { paddockId, date, notes }: { paddockId?: string; date?: string; notes?: string | null } = body;
  const data: Record<string, unknown> = {};
  if (paddockId) data.paddockId = paddockId;
  if (date) data.date = new Date(date);
  if (notes !== undefined) data.notes = notes || null;
  const allocation = await prisma.grazingAllocation.update({ where: { id }, data });
  return NextResponse.json({ allocation });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.grazingAllocation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
