import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { sizeHa?: number | null; landType?: string | null; code?: string } = {};
  if ("sizeHa" in body) data.sizeHa = body.sizeHa === null ? null : Number(body.sizeHa);
  if ("landType" in body) data.landType = body.landType;
  if ("code" in body) {
    const code = String(body.code).trim();
    if (!code) return NextResponse.json({ error: "Code can't be empty" }, { status: 400 });
    data.code = code;
  }

  try {
    const paddock = await prisma.paddock.update({ where: { id }, data });
    return NextResponse.json({ paddock });
  } catch {
    return NextResponse.json({ error: "A paddock with that code already exists on this farm" }, { status: 409 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const force = new URL(req.url).searchParams.get("force") === "true";

  if (!force) {
    const [activities, walks, grazing] = await Promise.all([
      prisma.fieldActivity.count({ where: { paddockId: id } }),
      prisma.pastureWalk.count({ where: { paddockId: id } }),
      prisma.grazingAllocation.count({ where: { paddockId: id } }),
    ]);
    if (activities || walks || grazing) {
      return NextResponse.json(
        { error: "This field has logged history", counts: { activities, walks, grazing } },
        { status: 409 }
      );
    }
  }

  await prisma.paddock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
