import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const section = searchParams.get("section");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!farmId || !section || !start || !end) {
    return NextResponse.json({ error: "farmId, section, start and end are required" }, { status: 400 });
  }

  const entries = await prisma.timeBookEntry.findMany({
    where: {
      date: { gte: new Date(start), lte: new Date(end) },
      worker: { farmId, section: section as "DAIRY" | "STAFF" },
    },
  });
  return NextResponse.json({ entries });
}

// Upsert one worker's mark for one date — re-posting the same
// workerId+date corrects it rather than duplicating.
export async function POST(req: Request) {
  const body = await req.json();
  const { workerId, date, code, overtime } = body as {
    workerId?: string;
    date?: string;
    code?: "PRESENT" | "LEAVE" | "ABSENT" | "OFF" | null;
    overtime?: string | null;
  };
  if (!workerId || !date) {
    return NextResponse.json({ error: "workerId and date are required" }, { status: 400 });
  }
  const entry = await prisma.timeBookEntry.upsert({
    where: { workerId_date: { workerId, date: new Date(date) } },
    update: { code: code ?? null, overtime: overtime || null },
    create: { workerId, date: new Date(date), code: code ?? null, overtime: overtime || null },
  });
  return NextResponse.json({ entry });
}
