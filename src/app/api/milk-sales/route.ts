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
  const entries = await prisma.milkSaleEntry.findMany({
    where: { farmId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ entries });
}

// Upsert — one sold-litres reading per farm per day (the whole tank goes at
// once, not per group). Doesn't have to match that day's total production —
// logging again for the same day just corrects it rather than duplicating.
export async function POST(req: Request) {
  const body = await req.json();
  const { farmId, date, litres, takenBy }: { farmId: string; date: string; litres: number; takenBy?: string | null } = body;
  if (!farmId || !date || litres == null || litres < 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const userId = await currentUserId();
  const entry = await prisma.milkSaleEntry.upsert({
    where: { farmId_date: { farmId, date: new Date(date) } },
    update: { litres, takenBy: takenBy || null, createdById: userId },
    create: { farmId, date: new Date(date), litres, takenBy: takenBy || null, createdById: userId },
  });
  return NextResponse.json({ entry });
}
