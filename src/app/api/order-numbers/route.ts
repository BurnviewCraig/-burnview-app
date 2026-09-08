import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const orderNumbers = await prisma.orderNumber.findMany({
    orderBy: { number: "desc" },
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ orderNumbers });
}

// Creates a blank order number — just the auto-incrementing number (displayed
// as "CS{number}") — so one exists to hand out immediately. Company/farm/item/
// comment are filled in afterward via PATCH.
export async function POST() {
  const userId = await currentUserId();
  const orderNumber = await prisma.orderNumber.create({
    data: { createdById: userId },
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ orderNumber });
}
