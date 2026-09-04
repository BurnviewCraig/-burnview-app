import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { boundaryAreaHectares, type BoundaryGeometry } from "@/lib/geo";

type ImportRow =
  | { paddockId: string; boundary: BoundaryGeometry }
  | { code: string; boundary: BoundaryGeometry };

export async function POST(req: Request) {
  const body = await req.json();
  const { farmId, rows }: { farmId: string; rows: ImportRow[] } = body;

  if (!farmId || !rows?.length) {
    return NextResponse.json({ error: "No fields to import" }, { status: 400 });
  }

  const updated = await prisma.$transaction(
    rows.map((row) => {
      const sizeHa = Math.round(boundaryAreaHectares(row.boundary) * 100) / 100;
      if ("paddockId" in row) {
        return prisma.paddock.update({
          where: { id: row.paddockId },
          data: { boundary: row.boundary, sizeHa },
        });
      }
      return prisma.paddock.upsert({
        where: { farmId_code: { farmId, code: row.code } },
        update: { boundary: row.boundary, sizeHa },
        create: { farmId, code: row.code, boundary: row.boundary, sizeHa },
      });
    })
  );

  return NextResponse.json({ count: updated.length });
}
