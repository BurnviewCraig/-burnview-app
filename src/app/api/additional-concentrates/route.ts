import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const concentrates = await prisma.additionalConcentrate.findMany({
    where: groupId ? { groupId } : undefined,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ concentrates });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { groupId, name, kgPerCow }: { groupId?: string; name?: string; kgPerCow?: number } = body;
  if (!groupId || !name?.trim() || kgPerCow == null || Number.isNaN(kgPerCow)) {
    return NextResponse.json({ error: "groupId, name and kgPerCow are required" }, { status: 400 });
  }
  const userId = await currentUserId();
  const concentrate = await prisma.additionalConcentrate.create({
    data: { groupId, name: name.trim(), kgPerCow, updatedById: userId },
  });
  return NextResponse.json({ concentrate });
}
