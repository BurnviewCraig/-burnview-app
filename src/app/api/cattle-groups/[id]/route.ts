import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await prisma.cattleGroup.findUnique({
    where: { id },
    include: {
      farm: { select: { id: true, name: true } },
      counts: { orderBy: { date: "desc" }, take: 1 },
      milkEntries: { orderBy: { date: "desc" }, take: 2 },
    },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    group: {
      id: group.id,
      farmId: group.farmId,
      farmName: group.farm.name,
      name: group.name,
      currentCount: group.counts[0]?.count ?? null,
      currentCountDate: group.counts[0]?.date.toISOString().slice(0, 10) ?? null,
      currentMilkPerCow: group.milkEntries[0]?.litresPerCow ?? null,
      currentMilkDate: group.milkEntries[0]?.date.toISOString().slice(0, 10) ?? null,
      previousMilkPerCow: group.milkEntries[1]?.litresPerCow ?? null,
    },
  });
}
