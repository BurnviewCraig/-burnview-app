import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");

  const groups = await prisma.cattleGroup.findMany({
    where: farmId ? { farmId } : undefined,
    orderBy: [{ farmId: "asc" }, { sortOrder: "asc" }],
    include: {
      counts: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      farmId: g.farmId,
      name: g.name,
      currentCount: g.counts[0]?.count ?? null,
      currentCountDate: g.counts[0]?.date.toISOString().slice(0, 10) ?? null,
    })),
  });
}
