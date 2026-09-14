import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

function serialize(e: {
  id: string;
  assetId: string;
  date: Date;
  worked: boolean;
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
    worked: e.worked,
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

// ?assetId= (that asset's full history — the per-asset printable report),
// ?farmId=&date= (one day across a farm's assets), or ?farmId= alone (that
// farm's full history across all its assets, so the daily dashboard can
// show computed closing/usage/rate — see lib/dieselCalc.ts — for whichever
// date is selected, not just raw entered values).
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

  if (farmId) {
    const entries = await prisma.dieselLogEntry.findMany({
      where: { asset: { farmId } },
      include: { driver: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ entries: entries.map(serialize) });
  }

  return NextResponse.json({ error: "assetId, or farmId and date, are required" }, { status: 400 });
}

// Upsert — one entry per asset per day. Each day's row is independent (its
// own driverId/readings), so correcting one day never touches another. A
// parked (worked:false) day is forced blank server-side regardless of what
// the client sends — it must never carry a reading/fill into the pro-rating
// math in the history report.
export async function POST(req: Request) {
  const body = await req.json();
  const {
    assetId,
    date,
    worked,
    openingReading,
    litresFilled,
    driverId,
    activities,
    paddockCodes,
    comment,
  }: {
    assetId?: string;
    date?: string;
    worked?: boolean;
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
  const isWorked = worked !== false;
  const data = isWorked
    ? {
        worked: true,
        openingReading: openingReading ?? null,
        litresFilled: litresFilled ?? null,
        driverId: driverId || null,
        activities: activities ?? [],
        paddockCodes: paddockCodes ?? [],
        comment: comment?.trim() || null,
        createdById: userId,
      }
    : {
        worked: false,
        openingReading: null,
        litresFilled: null,
        driverId: null,
        activities: [],
        paddockCodes: [],
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
