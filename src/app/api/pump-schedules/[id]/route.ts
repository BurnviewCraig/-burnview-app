import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, startTime, endTime, daysOfWeek, enabled } = body as { name?: string; startTime?: string; endTime?: string; daysOfWeek?: number[]; enabled?: boolean };

  const schedule = await prisma.pumpSchedule.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(startTime !== undefined ? { startTime } : {}),
      ...(endTime !== undefined ? { endTime } : {}),
      ...(daysOfWeek !== undefined ? { daysOfWeek } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    },
  });
  return NextResponse.json({ schedule });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.pumpSchedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
