import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cropType = searchParams.get("cropType");
  const varieties = await prisma.seedVariety.findMany({
    where: cropType ? { cropType } : undefined,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ varieties });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { cropType, name, costPerBag, seedsPerBag, daysToMaturity } = body as {
    cropType: string; name: string; costPerBag?: number | null; seedsPerBag?: number | null; daysToMaturity?: number | null;
  };
  if (!cropType?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "Crop and name are required" }, { status: 400 });
  }
  try {
    const variety = await prisma.seedVariety.create({
      data: {
        cropType: cropType.trim(),
        name: name.trim(),
        costPerBag: costPerBag ?? null,
        seedsPerBag: seedsPerBag ?? null,
        daysToMaturity: daysToMaturity ?? null,
      },
    });
    return NextResponse.json({ variety });
  } catch {
    return NextResponse.json({ error: "That variety already exists for this crop" }, { status: 409 });
  }
}
