import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json();
  const { itemId, mode, qty, date, farmId, paddockId } = body as {
    itemId: string;
    mode: "USE" | "RESTOCK";
    qty: number;
    date: string;
    farmId: string;
    paddockId?: string | null;
  };

  if (!itemId || !mode || !qty || qty <= 0 || !date || !farmId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userId = await currentUserId();

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.stockItem.findUniqueOrThrow({ where: { id: itemId } });
    const nextQty = mode === "USE" ? Math.max(0, item.qty - qty) : item.qty + qty;
    const updatedItem = await tx.stockItem.update({ where: { id: itemId }, data: { qty: nextQty } });
    const entry = await tx.stockEntry.create({
      data: {
        itemId,
        mode,
        qty,
        date: new Date(date),
        farmId,
        paddockId: paddockId || null,
        createdById: userId,
      },
    });
    return { item: updatedItem, entry };
  });

  return NextResponse.json(result);
}
