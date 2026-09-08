import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { company?: string | null; item?: string | null; comment?: string | null; farmId?: string | null } = {};
  if ("company" in body) data.company = body.company || null;
  if ("item" in body) data.item = body.item || null;
  if ("comment" in body) data.comment = body.comment || null;
  if ("farmId" in body) data.farmId = body.farmId || null;

  const orderNumber = await prisma.orderNumber.update({
    where: { id },
    data,
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ orderNumber });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.orderNumber.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
