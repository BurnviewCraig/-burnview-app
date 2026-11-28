import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Only ~28 meters x a year or so of monthly bills — small enough to fetch
// unfiltered and let the Eskom page do all the grouping/filtering client
// side, same as a few other "fetch everything" pages in this app.
export async function GET() {
  const bills = await prisma.electricityBill.findMany({
    orderBy: { billingDate: "asc" },
  });
  return NextResponse.json({ bills });
}
