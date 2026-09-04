import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paddockId = searchParams.get("paddockId");
  const farmId = searchParams.get("farmId");

  const walks = await prisma.pastureWalk.findMany({
    where: {
      ...(paddockId ? { paddockId } : {}),
      ...(farmId ? { farmId } : {}),
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ walks });
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    farmId,
    date,
    readings,
  }: { farmId: string; date: string; readings: { paddockId: string; cover: number }[] } = body;

  if (!farmId || !date || !readings?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userId = await currentUserId();

  const created = await prisma.$transaction(
    readings.map((r) =>
      prisma.pastureWalk.create({
        data: {
          farmId,
          paddockId: r.paddockId,
          date: new Date(date),
          cover: Math.round(r.cover),
          createdById: userId,
        },
      })
    )
  );

  return NextResponse.json({ walks: created });
}
