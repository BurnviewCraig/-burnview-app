import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  if (!farmId) {
    return NextResponse.json({ error: "farmId is required" }, { status: 400 });
  }
  const entries = await prisma.rainfallEntry.findMany({
    where: { farmId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ entries });
}

// Upsert — one reading per farm per day. Logging again for the same day
// just corrects that day's number rather than creating a duplicate.
export async function POST(req: Request) {
  const body = await req.json();
  const { farmId, date, mm }: { farmId: string; date: string; mm: number } = body;
  if (!farmId || !date || mm == null || mm < 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const userId = await currentUserId();
  const entry = await prisma.rainfallEntry.upsert({
    where: { farmId_date: { farmId, date: new Date(date) } },
    update: { mm, createdById: userId },
    create: { farmId, date: new Date(date), mm, createdById: userId },
  });
  return NextResponse.json({ entry });
}
