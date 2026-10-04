import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Distinct dates the farm's Rye grass camps have been walked, newest
// first — lets the wedge page step between actual past wedges (walk
// sessions) instead of raw calendar days, most of which have no new walk
// at all.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  if (!farmId) return NextResponse.json({ error: "farmId is required" }, { status: 400 });

  const walks = await prisma.pastureWalk.findMany({
    where: { farmId, paddock: { landType: "Rye grass" } },
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ dates: walks.map((w) => w.date.toISOString().slice(0, 10)) });
}
