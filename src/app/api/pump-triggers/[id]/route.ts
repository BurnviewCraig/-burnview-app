import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { deviceId, metric, comparison, threshold, action, stableDelayMinutes, enabled, respectRuraflex, overrideThreshold } = body as Record<string, unknown>;

  const trigger = await prisma.pumpTrigger.update({
    where: { id },
    data: {
      ...(deviceId !== undefined ? { deviceId: deviceId as string } : {}),
      ...(metric !== undefined ? { metric: metric as string } : {}),
      ...(comparison !== undefined ? { comparison: comparison as never } : {}),
      ...(threshold !== undefined ? { threshold: Number(threshold) } : {}),
      ...(action !== undefined ? { action: action as never } : {}),
      ...(stableDelayMinutes !== undefined ? { stableDelayMinutes: Number(stableDelayMinutes) } : {}),
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
      ...(respectRuraflex !== undefined ? { respectRuraflex: Boolean(respectRuraflex) } : {}),
      ...(overrideThreshold !== undefined ? { overrideThreshold: overrideThreshold === null ? null : Number(overrideThreshold) } : {}),
    },
  });
  return NextResponse.json({ trigger });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.pumpTrigger.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
