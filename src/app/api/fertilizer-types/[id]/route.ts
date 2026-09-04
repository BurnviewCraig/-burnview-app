import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { nitrogenPct, phosphorusPct, potassiumPct, sulfurPct } = body as {
    nitrogenPct: number;
    phosphorusPct: number;
    potassiumPct: number;
    sulfurPct: number;
  };

  const type = await prisma.fertilizerType.update({
    where: { id },
    data: {
      nitrogenPct: Number(nitrogenPct) || 0,
      phosphorusPct: Number(phosphorusPct) || 0,
      potassiumPct: Number(potassiumPct) || 0,
      sulfurPct: Number(sulfurPct) || 0,
      isPlaceholder: false,
    },
  });
  return NextResponse.json({ type });
}
