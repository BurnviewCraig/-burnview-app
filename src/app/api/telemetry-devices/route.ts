import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PUMP_KINDS = new Set(["PUMP_CONTROLLER", "PIVOT_CONTROLLER"]);

export async function GET() {
  const devices = await prisma.telemetryDevice.findMany({
    orderBy: [{ farm: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: { farm: { select: { id: true, name: true } }, pump: true },
  });

  // Latest reading per device+metric, fetched separately since Prisma can't
  // express "most recent row per group" in one findMany — fine at this
  // scale (a handful of devices, a handful of metrics each).
  const latestByDevice = new Map<string, Record<string, unknown>>();
  for (const d of devices) {
    const rows = await prisma.telemetryReading.findMany({
      where: { deviceId: d.id },
      orderBy: { recordedAt: "desc" },
      take: 20, // small cushion in case a device reports more than one metric
    });
    const byMetric: Record<string, unknown> = {};
    for (const r of rows) {
      if (!byMetric[r.metric]) byMetric[r.metric] = r;
    }
    latestByDevice.set(d.id, byMetric);
  }

  return NextResponse.json({
    devices: devices.map((d) => ({ ...d, latest: latestByDevice.get(d.id) ?? {} })),
  });
}

// Creates a device, and for a PUMP_CONTROLLER/PIVOT_CONTROLLER also its
// paired Pump row in the same request (pumpName required for those kinds).
// topicKey is generated from the farm+name rather than typed by hand, with
// a numeric suffix if that slug is already taken, since it just needs to be
// a stable, unique identifier to configure into the physical device later.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { farmId, name, kind, pumpName } = body as { farmId?: string; name?: string; kind?: string; pumpName?: string };
  if (!farmId || !name?.trim() || !kind) {
    return NextResponse.json({ error: "farmId, name and kind are required" }, { status: 400 });
  }
  if (PUMP_KINDS.has(kind) && !pumpName?.trim()) {
    return NextResponse.json({ error: "pumpName is required for a pump/pivot controller" }, { status: 400 });
  }

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true } });
  if (!farm) return NextResponse.json({ error: "Unknown farm" }, { status: 400 });

  const base = `${farm.slug}-${slugify(name.trim())}`;
  let topicKey = base;
  let n = 1;
  while (await prisma.telemetryDevice.findUnique({ where: { topicKey } })) {
    n += 1;
    topicKey = `${base}-${n}`;
  }

  const device = await prisma.telemetryDevice.create({
    data: {
      farmId,
      name: name.trim(),
      kind: kind as never,
      topicKey,
      ...(PUMP_KINDS.has(kind)
        ? { pump: { create: { farmId, name: pumpName!.trim() } } }
        : {}),
    },
    include: { farm: { select: { id: true, name: true } }, pump: true },
  });

  return NextResponse.json({ device });
}
