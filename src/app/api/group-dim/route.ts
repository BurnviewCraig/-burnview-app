import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }
  const entries = await prisma.groupDimEntry.findMany({
    where: { groupId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ entries });
}

// Upsert — one days-in-milk reading per group per day, same pattern as
// weight/milk/headcount.
export async function POST(req: Request) {
  const body = await req.json();
  const { groupId, date, avgDaysInMilk }: { groupId?: string; date?: string; avgDaysInMilk?: number } = body;
  if (!groupId || !date || avgDaysInMilk == null || Number.isNaN(avgDaysInMilk)) {
    return NextResponse.json({ error: "groupId, date and avgDaysInMilk are required" }, { status: 400 });
  }
  const userId = await currentUserId();
  const entry = await prisma.groupDimEntry.upsert({
    where: { groupId_date: { groupId, date: new Date(date) } },
    update: { avgDaysInMilk, createdById: userId },
    create: { groupId, date: new Date(date), avgDaysInMilk, createdById: userId },
  });
  return NextResponse.json({ entry });
}
