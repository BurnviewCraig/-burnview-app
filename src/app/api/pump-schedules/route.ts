import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pumpId = searchParams.get("pumpId") ?? undefined;
  const schedules = await prisma.pumpSchedule.findMany({
    where: pumpId ? { pumpId } : undefined,
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ schedules });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { pumpId, name, startTime, endTime, daysOfWeek } = body as { pumpId?: string; name?: string; startTime?: string; endTime?: string; daysOfWeek?: number[] };
  if (!pumpId || !name?.trim() || !startTime || !endTime) {
    return NextResponse.json({ error: "pumpId, name, startTime and endTime are required" }, { status: 400 });
  }
  const schedule = await prisma.pumpSchedule.create({
    data: { pumpId, name: name.trim(), startTime, endTime, daysOfWeek: daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6] },
  });
  return NextResponse.json({ schedule });
}
