import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pumpId = searchParams.get("pumpId") ?? undefined;
  const triggers = await prisma.pumpTrigger.findMany({
    where: pumpId ? { pumpId } : undefined,
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ triggers });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { pumpId, deviceId, metric, comparison, threshold, action } = body as Record<string, unknown>;
  if (!pumpId || !deviceId || !metric || !comparison || threshold == null || !action) {
    return NextResponse.json({ error: "pumpId, deviceId, metric, comparison, threshold and action are required" }, { status: 400 });
  }
  const trigger = await prisma.pumpTrigger.create({
    data: {
      pumpId: pumpId as string,
      deviceId: deviceId as string,
      metric: metric as string,
      comparison: comparison as never,
      threshold: Number(threshold),
      action: action as never,
    },
  });
  return NextResponse.json({ trigger });
}
