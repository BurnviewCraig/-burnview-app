import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const pivots = await prisma.pivot.findMany({
    orderBy: [{ farm: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ pivots });
}
