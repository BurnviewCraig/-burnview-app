import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Only the two equipment ratings are editable here — name and paddockCodes
// are fixed, seeded from FARM_SECTIONS (see schema comment on Pivot), since
// pivots don't move or get renamed.
function parseRating(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  return raw != null && raw !== "" ? Number(raw) : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const mmAt100Pct = parseRating(body.mmAt100Pct);
  const hoursAt100Pct = parseRating(body.hoursAt100Pct);
  for (const v of [mmAt100Pct, hoursAt100Pct]) {
    if (v != null && (Number.isNaN(v) || v < 0)) {
      return NextResponse.json({ error: "Ratings must be non-negative numbers" }, { status: 400 });
    }
  }

  const pivot = await prisma.pivot.update({
    where: { id },
    data: { mmAt100Pct, hoursAt100Pct },
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ pivot });
}
