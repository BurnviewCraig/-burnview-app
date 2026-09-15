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
  const entries = await prisma.groupFeedEntry.findMany({
    where: { groupId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ entries });
}

// Upsert — one feed reading per group per day. Logging again for the same
// day just corrects that day's numbers rather than creating a duplicate.
export async function POST(req: Request) {
  const body = await req.json();
  const {
    groupId,
    date,
    dairyMealKg,
    otherConcentrateName,
    otherConcentrateKg,
    silageKg,
  }: {
    groupId?: string;
    date?: string;
    dairyMealKg?: number | null;
    otherConcentrateName?: string | null;
    otherConcentrateKg?: number | null;
    silageKg?: number | null;
  } = body;
  if (!groupId || !date) {
    return NextResponse.json({ error: "groupId and date are required" }, { status: 400 });
  }
  const userId = await currentUserId();
  const data = {
    dairyMealKg: dairyMealKg ?? null,
    otherConcentrateName: otherConcentrateName?.trim() || null,
    otherConcentrateKg: otherConcentrateKg ?? null,
    silageKg: silageKg ?? null,
    createdById: userId,
  };
  const entry = await prisma.groupFeedEntry.upsert({
    where: { groupId_date: { groupId, date: new Date(date) } },
    update: data,
    create: { groupId, date: new Date(date), ...data },
  });
  return NextResponse.json({ entry });
}
