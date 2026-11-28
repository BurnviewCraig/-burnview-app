import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Name and farm assignment are both editable here — the import script only
// ever sets them the first time a new Eskom account shows up (see
// eskom-import.mjs), so a correction made here always sticks.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name === "") return NextResponse.json({ error: "Name can't be blank" }, { status: 400 });
  const data: { name?: string; farmId?: string | null } = {};
  if (name !== undefined) data.name = name;
  if ("farmId" in body) data.farmId = body.farmId || null;
  const meter = await prisma.electricityMeter.update({
    where: { id },
    data,
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ meter });
}
