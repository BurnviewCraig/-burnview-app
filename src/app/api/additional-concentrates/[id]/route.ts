import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; kgPerCow?: number; updatedById?: string | null } = {};
  if ("name" in body) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    data.name = name;
  }
  if ("kgPerCow" in body) {
    const kgPerCow = Number(body.kgPerCow);
    if (Number.isNaN(kgPerCow)) return NextResponse.json({ error: "kgPerCow must be a number" }, { status: 400 });
    data.kgPerCow = kgPerCow;
  }
  data.updatedById = await currentUserId();

  const concentrate = await prisma.additionalConcentrate.update({ where: { id }, data });
  return NextResponse.json({ concentrate });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.additionalConcentrate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
