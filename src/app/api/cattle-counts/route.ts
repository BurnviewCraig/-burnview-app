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
  const counts = await prisma.cattleCountEntry.findMany({
    where: { groupId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ counts });
}

// Upsert — one count per group per day. Logging again for the same day just
// corrects that day's number rather than creating a duplicate.
export async function POST(req: Request) {
  const body = await req.json();
  const { groupId, date, count }: { groupId: string; date: string; count: number } = body;
  if (!groupId || !date || count == null || count < 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const userId = await currentUserId();
  const entry = await prisma.cattleCountEntry.upsert({
    where: { groupId_date: { groupId, date: new Date(date) } },
    update: { count: Math.round(count), createdById: userId },
    create: { groupId, date: new Date(date), count: Math.round(count), createdById: userId },
  });
  return NextResponse.json({ count: entry });
}
