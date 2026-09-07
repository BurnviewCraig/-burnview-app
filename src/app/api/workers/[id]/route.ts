import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; sortOrder?: number } = {};
  if ("name" in body) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    data.name = name;
  }
  if ("sortOrder" in body) data.sortOrder = Number(body.sortOrder);
  const worker = await prisma.worker.update({ where: { id }, data });
  return NextResponse.json({ worker });
}

// Soft-delete — removes the worker from the active roster/grid but keeps
// their past attendance history intact rather than cascading it away.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.worker.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
