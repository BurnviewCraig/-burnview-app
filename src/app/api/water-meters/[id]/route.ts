import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Only name/groupName are editable here — the meters themselves are seeded
// once and don't move, same as pivots.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const groupName = typeof body.groupName === "string" ? body.groupName.trim() : undefined;
  if (name === "" || groupName === "") {
    return NextResponse.json({ error: "Name and group can't be blank" }, { status: 400 });
  }
  const meter = await prisma.waterMeter.update({ where: { id }, data: { name, groupName } });
  return NextResponse.json({ meter });
}
