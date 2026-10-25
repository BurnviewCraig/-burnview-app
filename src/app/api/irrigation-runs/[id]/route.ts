import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: { date?: Date; percentage?: number; startPaddockId?: string | null; notes?: string | null } = {};
  if ("date" in body) data.date = new Date(body.date);
  if ("percentage" in body) data.percentage = Math.round(Number(body.percentage));
  if ("startPaddockId" in body) data.startPaddockId = body.startPaddockId || null;
  if ("notes" in body) data.notes = body.notes ? String(body.notes).trim() : null;

  const run = await prisma.irrigationRun.update({
    where: { id },
    data,
    include: { startPaddock: { select: { id: true, code: true } } },
  });
  return NextResponse.json({ run });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.irrigationRun.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
