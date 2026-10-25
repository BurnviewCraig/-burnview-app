import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const readings = await prisma.waterMeterReading.findMany({ orderBy: { date: "asc" } });
  return NextResponse.json({ readings });
}

// Upsert — one reading per meter per day. Logging again for the same day
// just corrects that day's dial figure rather than creating a duplicate,
// same pattern as rainfall/milk.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const meterId = (body as { meterId?: string }).meterId;
  const date = (body as { date?: string }).date;
  const reading = Number((body as { reading?: number }).reading);
  if (!meterId || !date || !Number.isFinite(reading) || reading < 0) {
    return NextResponse.json({ error: "meterId, date and a non-negative reading are required" }, { status: 400 });
  }
  const notes = (body as { notes?: string }).notes?.trim() || null;

  const userId = await currentUserId();
  const entry = await prisma.waterMeterReading.upsert({
    where: { meterId_date: { meterId, date: new Date(date) } },
    update: { reading, notes, createdById: userId },
    create: { meterId, date: new Date(date), reading, notes, createdById: userId },
  });
  return NextResponse.json({ entry });
}
