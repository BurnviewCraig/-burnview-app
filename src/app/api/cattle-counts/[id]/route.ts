import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { date, count }: { date?: string; count?: number } = body;
  const data: Record<string, unknown> = {};
  if (date) data.date = new Date(date);
  if (count != null) data.count = Math.round(count);
  const entry = await prisma.cattleCountEntry.update({ where: { id }, data });
  return NextResponse.json({ count: entry });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.cattleCountEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
