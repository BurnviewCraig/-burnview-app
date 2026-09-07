import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; role?: string | null; notes?: string | null; sortOrder?: number; active?: boolean } = {};
  if ("name" in body) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    data.name = name;
  }
  if ("role" in body) data.role = body.role ? String(body.role).trim() || null : null;
  if ("notes" in body) data.notes = body.notes ? String(body.notes).trim() || null : null;
  if ("sortOrder" in body) data.sortOrder = Number(body.sortOrder);
  if ("active" in body) data.active = Boolean(body.active);
  const worker = await prisma.worker.update({ where: { id }, data });
  return NextResponse.json({ worker });
}

// Soft-delete — removes the worker from the active roster/grid but keeps
// their past attendance history intact rather than cascading it away. Never
// hard-deleted; can always be restored via PATCH { active: true }.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.worker.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
