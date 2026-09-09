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
  const entries = await prisma.milkProductionEntry.findMany({
    where: { groupId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ entries });
}

// Upsert — one litres-per-cow reading per group per day. Logging again for
// the same day just corrects that day's number rather than creating a duplicate.
export async function POST(req: Request) {
  const body = await req.json();
  const { groupId, date, litresPerCow }: { groupId: string; date: string; litresPerCow: number } = body;
  if (!groupId || !date || litresPerCow == null || litresPerCow < 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const userId = await currentUserId();
  const entry = await prisma.milkProductionEntry.upsert({
    where: { groupId_date: { groupId, date: new Date(date) } },
    update: { litresPerCow, createdById: userId },
    create: { groupId, date: new Date(date), litresPerCow, createdById: userId },
  });
  return NextResponse.json({ entry });
}
