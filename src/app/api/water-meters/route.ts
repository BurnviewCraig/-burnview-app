import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const meters = await prisma.waterMeter.findMany({
    orderBy: [{ farm: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ meters });
}
