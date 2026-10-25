import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Only the mm-per-pass-at-100%-speed rating is editable here — name and
// paddockCodes are fixed, seeded from FARM_SECTIONS (see schema comment on
// Pivot), since pivots don't move or get renamed.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const mmAt100Pct = body.mmAt100Pct != null && body.mmAt100Pct !== "" ? Number(body.mmAt100Pct) : null;
  if (mmAt100Pct != null && (Number.isNaN(mmAt100Pct) || mmAt100Pct < 0)) {
    return NextResponse.json({ error: "mmAt100Pct must be a non-negative number" }, { status: 400 });
  }
  const pivot = await prisma.pivot.update({
    where: { id },
    data: { mmAt100Pct },
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ pivot });
}
