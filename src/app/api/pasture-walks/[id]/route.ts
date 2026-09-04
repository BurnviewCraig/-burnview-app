import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { date, cover }: { date?: string; cover?: number } = body;

  const walk = await prisma.pastureWalk.update({
    where: { id },
    data: {
      date: date ? new Date(date) : undefined,
      cover: cover != null ? Math.round(cover) : undefined,
    },
  });
  return NextResponse.json({ walk });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.pastureWalk.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
