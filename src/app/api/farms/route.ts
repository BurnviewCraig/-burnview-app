import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const farms = await prisma.farm.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      paddocks: {
        select: { id: true, code: true, sizeHa: true, landType: true, boundary: true },
      },
    },
  });
  return NextResponse.json({ farms });
}
