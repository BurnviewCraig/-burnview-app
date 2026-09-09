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

// Always creates a new collection — a farm can have several buyers taking
// milk on the same day, so this doesn't correct/overwrite same-day entries
// the way headcount/production/rainfall do. Wrong entries are fixed via
// PATCH/DELETE on /api/milk-sales/[id] instead.
export async function POST(req: Request) {
  const body = await req.json();
  const { farmId, date, litres, takenBy }: { farmId: string; date: string; litres: number; takenBy?: string | null } = body;
  if (!farmId || !date || litres == null || litres < 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const userId = await currentUserId();
  const entry = await prisma.milkSaleEntry.create({
    data: { farmId, date: new Date(date), litres, takenBy: takenBy || null, createdById: userId },
  });
  return NextResponse.json({ entry });
}
