import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

function serialize(e: {
  id: string;
  assetId: string;
  date: Date;
  openingReading: number | null;
  litresFilled: number | null;
  driverId: string | null;
  driver: { id: string; name: string } | null;
  activities: unknown;
  paddockCodes: unknown;
  comment: string | null;
  createdAt: Date;
}) {
  return {
    id: e.id,
    assetId: e.assetId,
    date: e.date.toISOString().slice(0, 10),
    openingReading: e.openingReading,
    litresFilled: e.litresFilled,
    driverId: e.driverId,
    driver: e.driver,
    activities: (e.activities as string[] | null) ?? [],
    paddockCodes: (e.paddockCodes as string[] | null) ?? [],
    comment: e.comment,
    createdAt: e.createdAt.toISOString(),
  };
}

// Either ?assetId= (that asset's full history, for the daily dashboard's
// "last used driver" lookup and the per-asset printable report) or
// ?farmId=&date= (one day's entries across a farm's assets, for the
// dashboard).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");
  const farmId = searchParams.get("farmId");
  const date = searchParams.get("date");

  if (assetId) {
    const entries = await prisma.dieselLogEntry.findMany({
      where: { assetId },
      include: { driver: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ entries: entries.map(serialize) });
  }

  if (farmId && date) {
    const entries = await prisma.dieselLogEntry.findMany({
      where: { date: new Date(date), asset: { farmId } },
      include: { driver: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ entries: entries.map(serialize) });
  }

  return NextResponse.json({ error: "assetId, or farmId and date, are required" }, { status: 400 });
}

// Upsert — one entry per asset per day. Each day's row is independent (its
// own driverId/readings), so correcting one day never touches another.
export async function POST(req: Request) {
  const body = await req.json();
  const {
    assetId,
    date,
    openingReading,
    litresFilled,
    driverId,
    activities,
    paddockCodes,
    comment,
  }: {
    assetId?: string;
    date?: string;
    openingReading?: number | null;
    litresFilled?: number | null;
    driverId?: string | null;
    activities?: string[];
    paddockCodes?: string[];
    comment?: string | null;
  } = body;
  if (!assetId || !date) {
    return NextResponse.json({ error: "assetId and date are required" }, { status: 400 });
  }
  const userId = await currentUserId();
  const data = {
    openingReading: openingReading ?? null,
    litresFilled: litresFilled ?? null,
    driverId: driverId || null,
    activities: activities ?? [],
    paddockCodes: paddockCodes ?? [],
    comment: comment?.trim() || null,
    createdById: userId,
  };
  const entry = await prisma.dieselLogEntry.upsert({
    where: { assetId_date: { assetId, date: new Date(date) } },
    update: data,
    create: { assetId, date: new Date(date), ...data },
    include: { driver: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ entry: serialize(entry) });
}
