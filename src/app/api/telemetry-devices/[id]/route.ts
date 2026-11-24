import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, active, pumpName, calibrationOffset, calibrationScale } = body as {
    name?: string; active?: boolean; pumpName?: string; calibrationOffset?: number; calibrationScale?: number;
  };

  const device = await prisma.telemetryDevice.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(pumpName !== undefined ? { pump: { update: { name: pumpName.trim() } } } : {}),
      ...(calibrationOffset !== undefined ? { calibrationOffset: Number(calibrationOffset) } : {}),
      ...(calibrationScale !== undefined ? { calibrationScale: Number(calibrationScale) } : {}),
    },
    include: { farm: { select: { id: true, name: true } }, pump: true },
  });
  return NextResponse.json({ device });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.telemetryDevice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
