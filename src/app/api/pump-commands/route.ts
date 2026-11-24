import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// Creates a PENDING manual start/stop instruction. Nothing in this app ever
// talks to MQTT directly — the (not yet built) always-on worker is what
// polls for PENDING rows, actually publishes the command, and moves it on
// to SENT/CONFIRMED/FAILED. Until that worker exists, these just sit here
// as a record of what was asked for.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { pumpId, action } = body as { pumpId?: string; action?: string };
  if (!pumpId || (action !== "START" && action !== "STOP")) {
    return NextResponse.json({ error: "pumpId and action (START|STOP) are required" }, { status: 400 });
  }
  const userId = await currentUserId();
  const command = await prisma.pumpCommand.create({
    data: { pumpId, action, source: "MANUAL", requestedById: userId },
  });
  return NextResponse.json({ command });
}
