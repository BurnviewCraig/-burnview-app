import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Read-only — these rows come from the weekly Clover quality card import
// (scripts/clover-import.mjs), not from anything in the app itself.
export async function GET() {
  const entries = await prisma.milkQualityEntry.findMany({ orderBy: { date: "asc" } });
  return NextResponse.json({ entries });
}
