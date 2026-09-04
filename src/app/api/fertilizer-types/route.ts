import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const types = await prisma.fertilizerType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ types });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, nitrogenPct, phosphorusPct, potassiumPct, sulfurPct } = body as {
    name: string;
    nitrogenPct?: number;
    phosphorusPct?: number;
    potassiumPct?: number;
    sulfurPct?: number;
  };
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const hasNutrients = [nitrogenPct, phosphorusPct, potassiumPct, sulfurPct].some((v) => v);
  try {
    const type = await prisma.fertilizerType.create({
      data: {
        name: name.trim(),
        nitrogenPct: Number(nitrogenPct) || 0,
        phosphorusPct: Number(phosphorusPct) || 0,
        potassiumPct: Number(potassiumPct) || 0,
        sulfurPct: Number(sulfurPct) || 0,
        isPlaceholder: !hasNutrients,
      },
    });
    return NextResponse.json({ type });
  } catch {
    return NextResponse.json({ error: "A fertilizer with that name already exists" }, { status: 409 });
  }
}
