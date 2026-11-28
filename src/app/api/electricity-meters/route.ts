import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const meters = await prisma.electricityMeter.findMany({
    where: { active: true },
    include: { farm: { select: { id: true, name: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ meters });
}
