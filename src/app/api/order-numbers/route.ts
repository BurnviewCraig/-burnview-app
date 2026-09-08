import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";
import { ORDER_NUMBER_ISSUERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const orderNumbers = await prisma.orderNumber.findMany({
    orderBy: { createdAt: "desc" },
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ orderNumbers });
}

// Creates a blank order number for the chosen issuer — just prefix + the
// next sequential number for that prefix (CS1, CS2… / HS1, HS2… / TS1, TS2…
// run independently) — so one exists to hand out immediately.
// Company/farm/item/comment are filled in afterward via PATCH.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prefix = (body as { prefix?: string }).prefix;
  if (!ORDER_NUMBER_ISSUERS.some((i) => i.prefix === prefix)) {
    return NextResponse.json({ error: "Unknown issuer" }, { status: 400 });
  }

  const userId = await currentUserId();
  const orderNumber = await prisma.$transaction(async (tx) => {
    const last = await tx.orderNumber.findFirst({
      where: { prefix },
      orderBy: { number: "desc" },
    });
    return tx.orderNumber.create({
      data: { prefix: prefix!, number: (last?.number ?? 0) + 1, createdById: userId },
      include: { farm: { select: { id: true, name: true } } },
    });
  });
  return NextResponse.json({ orderNumber });
}
